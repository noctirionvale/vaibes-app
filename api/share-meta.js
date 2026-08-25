// api/share-meta.js
import { createClient } from '@supabase/supabase-js';

let supabase;
function getSupabase() {
  if (!supabase) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      throw new Error('Missing SUPABASE_URL / SUPABASE_ANON_KEY env vars');
    }
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  }
  return supabase;
}

const TEASER_CHAR_LIMIT = 200;

const escapeHtml = (str = '') =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const stripHtml = (html = '') => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const truncateAtWord = (text, limit = TEASER_CHAR_LIMIT) => {
  if (!text || text.length <= limit) return text || '';
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + '…';
};

function renderMeta(res, { title, description, image, pageUrl }) {
  // Force absolute image URL
  if (image && !image.startsWith('http')) {
    const host = res.req?.headers?.host || 'vaibes.pro';
    image = `https://${host}${image.startsWith('/') ? '' : '/'}${image}`;
  }

  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  
  // REMOVED: <meta http-equiv="refresh">
  // Bots stop parsing after the <head>. Humans never see this body because 
  // vercel.json routes them directly to the React app.
  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${pageUrl}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${image}" />
  <meta name="twitter:site" content="@vaibes" />
</head>
<body>
  <!-- Bots don't read the body. Humans won't see this. -->
</body>
</html>`);
}

export default async function handler(req, res) {
  const { id, type } = req.query;
  const siteUrl = `https://${req.headers.host}`;

  const fallback = {
    title: 'vAIbes',
    description: 'Learn smarter, create freely, connect instantly.',
    image: `${siteUrl}/og-default.png`,
    pageUrl: `${siteUrl}/share/${type === 'quiz' ? `quiz/${id}` : id}`,
  };

  try {
    const db = getSupabase();
    let meta = { ...fallback };

    if (type === 'quiz') {
      const { data: post, error } = await db
        .from('edufeed_posts')
        .select('title, quiz_data, attachments, is_published')
        .eq('id', id).eq('is_published', true).maybeSingle();

      if (error) console.error('share-meta quiz query error:', error.message);

      if (post) {
        meta.title = escapeHtml(post.title || 'A quiz on vAIbes');
        const questionText = post.quiz_data?.question || post.quiz_data?.questions?.[0]?.question || '';
        meta.description = escapeHtml(truncateAtWord(stripHtml(questionText))) || 'Test what you know on vAIbes.';
        const imgAtt = post.attachments?.find(a => a.type?.startsWith('image/'));
        if (imgAtt?.url) meta.image = imgAtt.url;
      }
    } else {
      const { data: item, error } = await db
        .from('user_creatives')
        .select('title, content, attachments, is_public')
        .eq('id', id).eq('is_public', true).maybeSingle();

      if (error) console.error('share-meta wall query error:', error.message);

      if (item) {
        meta.title = escapeHtml(item.title || 'vAIbes');
        meta.description = item.content ? escapeHtml(truncateAtWord(stripHtml(item.content))) : meta.description;
        const imgAtt = item.attachments?.find(a => a.type?.startsWith('image/'));
        if (imgAtt?.url) meta.image = imgAtt.url;
      }
    }

    renderMeta(res, meta);
  } catch (err) {
    console.error('share-meta fatal error:', err.message);
    renderMeta(res, fallback);
  }
}