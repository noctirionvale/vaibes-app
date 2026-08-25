import crypto from 'crypto';

const ADMIN_EMAIL = 'noctirionvale@gmail.com';
const MAX_WORDS = 6000;

// ── Cost-control knobs ──────────────────────────────────────────
// Credits are the whole access model here too (see handleChat) —
// an authenticated, non-admin user draws from their wallet
// regardless of any "plan" flag. Unauthenticated requests get a
// small daily trial by IP so people can try Vaibey before signing
// up.
const RATE_LIMIT_PER_MINUTE = 10;
const MAX_OUTPUT_TOKENS = 1000;
const MAX_INPUT_CHARS = 24000;
const FREE_DAILY_LIMIT = 3;
const MAX_PDF_BYTES = 10 * 1024 * 1024;  // matches the frontend's 10MB cap — enforced here too, don't trust the client alone
const MAX_PDF_PAGES = 40;                // unpdf's own guidance: page count drives extraction time, check before extracting
const MAX_PDF_CHARS = 30000;             // extracted text sent to DeepSeek — same role MAX_INPUT_CHARS plays for /chat
const PDF_EXTRACT_TIMEOUT_MS = 15000;    // tune against your actual Vercel function duration limit

// ─────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────

function extractYouTubeId(url) {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
  return match ? match[1] : null;
}

function isSafeUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();
    if (['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(hostname)) return false;
    if (hostname.startsWith('169.254.') || hostname.endsWith('.local')) return false;
    return true;
  } catch {
    return false;
  }
}

// 🔒 FIXED: the original called fetch(url) with default redirect
// handling, so isSafeUrl only ever checked the URL the user typed —
// a redirect to http://169.254.169.254/... (cloud metadata) or
// http://localhost/... would sail through untouched. This follows
// redirects manually and re-validates every hop.
async function safeFetch(url, options = {}, maxRedirects = 5) {
  let currentUrl = url;
  for (let i = 0; i <= maxRedirects; i++) {
    if (!isSafeUrl(currentUrl)) {
      throw new Error('Invalid or blocked URL (SSRF protection)');
    }
    const response = await fetch(currentUrl, { ...options, redirect: 'manual' });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Redirect with no location header');
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }
    return response;
  }
  throw new Error('Too many redirects');
}

// Hashes "<namespace>:<ip>" before it ever touches the database —
// namespace keeps /chat and /fetch-content limits independent; the
// hash means raw IPs never sit in a table. Set IP_HASH_SALT in your
// env for a real secret; the fallback here is just so local dev
// doesn't crash without one.
function hashKey(namespace, ip) {
  return crypto
    .createHash('sha256')
    .update(`${namespace}:${ip}:${process.env.IP_HASH_SALT || 'vaibes-dev-salt'}`)
    .digest('hex');
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  return (
    (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0].trim()) ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

function totalMessageChars(messages) {
  return messages.reduce((sum, m) => sum + (typeof m.content === 'string' ? m.content.length : 0), 0);
}

// Puts a reserved credit back after a failed downstream AI call.
async function refundCredit(supabase, userId) {
  if (!userId) return;
  const { error } = await supabase.rpc('refund_ai_credit', { p_user_id: userId });
  if (error) console.error('refund_ai_credit error:', error);
}

async function fetchUserContext(supabase, userId, threadId = null) {
  try {
    const queries = [
      supabase
        .from('user_creatives')
        .select('title, content, subject, media_type')
        .eq('user_id', userId)
        .eq('media_type', 'note')
        .order('created_at', { ascending: false })
        .limit(15),

      supabase
        .from('user_creatives')
        .select('title, content, subject')
        .eq('user_id', userId)
        .eq('edufeed_status', 'approved')
        .order('created_at', { ascending: false })
        .limit(10),

      supabase
        .from('user_quiz_results')
        .select('topic, is_correct, attempted_at')
        .eq('user_id', userId)
        .order('attempted_at', { ascending: false })
        .limit(10),
    ];

    if (threadId) {
      queries.push(
        supabase
          .from('conversation_threads')
          .select('messages')
          .eq('id', threadId)
          .single()
      );
    }

    const results = await Promise.all(queries);
    const [notesResult, edufeedResult, quizResult, threadResult] = results;

    const notes = notesResult.data || [];
    const posts = edufeedResult.data || [];
    const quizzes = quizResult.data || [];
    const threadMessages = threadResult?.data?.messages || [];

    let context = '';

    if (notes.length > 0) {
      context += `\n\n📝 RECENT NOTES:\n`;
      notes.forEach((n) => {
        context += `- ${n.title || 'Untitled'} (${n.subject || 'General'}): ${n.content?.slice(0, 300) || ''}\n`;
      });
    }

    if (posts.length > 0) {
      context += `\n\n📚 EDUFEED POSTS:\n`;
      posts.forEach((p) => {
        context += `- ${p.title || 'Untitled'} (${p.subject || 'General'}): ${p.content?.slice(0, 200) || ''}\n`;
      });
    }

    if (quizzes.length > 0) {
      context += `\n\n🎯 QUIZ PERFORMANCE:\n`;
      quizzes.forEach((q) => {
        context += `- ${q.topic}: ${q.is_correct ? '✅ Correct' : '❌ Incorrect'} (${new Date(q.attempted_at).toLocaleDateString()})\n`;
      });
    }

    if (threadMessages.length > 0) {
      context += `\n\n💬 CONVERSATION THREAD (continuing from previous discussion):\n`;
      threadMessages.forEach((msg, idx) => {
        context += `\n[Message ${idx + 1}]\n${msg.role === 'user' ? 'User' : 'You'}: "${msg.content.slice(0, 500)}${msg.content.length > 500 ? '...' : ''}"\n`;
      });
      context += `\n\nThe user is continuing this conversation. Reference previous exchanges naturally and build on what was discussed.`;
    }

    return context;
  } catch (error) {
    console.error('Context fetch error:', error);
    return '';
  }
}

// ─────────────────────────────────────────────────────────────
// Action: chat (Vaibey personalized assistant)
// ─────────────────────────────────────────────────────────────
// 🔒 CHANGED: this used to rate-limit only non-pro/non-admin users,
// and only with an in-memory Map — which its own comment admitted
// "resets per cold start / per instance", i.e. doesn't reliably
// limit anything in a real serverless deployment. Pro and admin
// users had NO limit of any kind. Now: admins bypass, every other
// authenticated user draws from their DB-backed credit wallet
// (atomic reserve + per-minute limit in one call), and genuinely
// logged-out requests get a small DB-backed daily trial by IP.

async function handleChat(req, res) {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  let isAdmin = false;
  let userId = null;

  const authHeader = req.headers['authorization'];
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);
      if (!error && user) {
        userId = user.id;
        isAdmin = user.email === ADMIN_EMAIL;
      }
    } catch (e) {
      console.error('Auth check error:', e);
    }
  }

  let creditsRemaining = null;

  if (isAdmin) {
    // unlimited, unmetered
  } else if (userId) {
    // Authenticated: spend a credit. No separate "pro plan" check —
    // having credits IS having access. Top up subscribers' wallets
    // out-of-band (e.g. a monthly cron calling grant_ai_credits).
    const { data, error } = await supabase.rpc('consume_ai_credit', {
      p_user_id: userId,
      p_rate_limit_per_minute: RATE_LIMIT_PER_MINUTE,
    });
    if (error) {
      console.error('consume_ai_credit error:', error);
      return res.status(500).json({ error: 'Could not verify your credit balance. Please try again.' });
    }
    const result = data?.[0];
    if (!result?.success) {
      if (result?.reason === 'rate_limited') {
        return res.status(429).json({ error: `Too many requests — max ${RATE_LIMIT_PER_MINUTE}/minute.` });
      }
      return res.status(402).json({ error: 'No AI credits remaining. Please top up to continue.', code: 'NO_CREDITS' });
    }
    creditsRemaining = result.remaining;
  } else {
    // Not logged in: small daily trial by IP, backed by the DB so it
    // actually holds up across cold starts and multiple instances.
    const ip = getClientIp(req);
    const keyHash = hashKey('chat', ip);
    const { data, error } = await supabase.rpc('consume_anonymous_request', {
      p_key_hash: keyHash,
      p_max_per_window: FREE_DAILY_LIMIT,
    });
    if (error) {
      console.error('consume_anonymous_request error:', error);
      return res.status(500).json({ error: 'Could not verify usage. Please try again.' });
    }
    const result = data?.[0];
    if (!result?.success) {
      return res.status(429).json({
        error: 'Daily trial limit reached. Sign in and grab an AI credit pack for unlimited-feeling access.',
        code: 'LIMIT_REACHED',
      });
    }
  }

  try {
    const { messages, thread_id } = req.body;
    let enhancedMessages = messages || [];

    if (!Array.isArray(enhancedMessages) || enhancedMessages.length === 0) {
      if (userId && !isAdmin) await refundCredit(supabase, userId);
      return res.status(400).json({ error: 'No messages provided.' });
    }
    if (totalMessageChars(enhancedMessages) > MAX_INPUT_CHARS) {
      if (userId && !isAdmin) await refundCredit(supabase, userId);
      return res.status(413).json({ error: `Conversation too long — keep total content under ${MAX_INPUT_CHARS} characters.` });
    }

    if (userId && enhancedMessages.length > 0) {
      const userContext = await fetchUserContext(supabase, userId, thread_id);

      if (userContext) {
        const systemMsgIndex = enhancedMessages.findIndex((m) => m.role === 'system');

        const vaibeySystemPrompt = `You are Vaibey, a personalized AI study assistant for vAIbes. You are NOT a generic chatbot — you are a study partner who knows this specific student deeply.

YOUR KNOWLEDGE ABOUT THIS USER:${userContext}

YOUR BEHAVIOR:
1. Reference their notes, posts, and quiz history when relevant
2. Connect new questions to what they've already studied
3. Identify weak areas based on quiz performance
4. Use their writing style and terminology
5. Be encouraging but honest about gaps in understanding
6. When explaining concepts, tie them to their existing knowledge
7. If continuing a thread, naturally reference previous exchanges
8. Always be warm, helpful, and personalized

Always be warm, helpful, and personalized. You're their study buddy, not a textbook.`;

        if (systemMsgIndex >= 0) {
          enhancedMessages[systemMsgIndex].content += vaibeySystemPrompt;
        } else {
          enhancedMessages = [{ role: 'system', content: vaibeySystemPrompt }, ...enhancedMessages];
        }
      }
    }

    const apiResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        thinking: { type: 'disabled' },
        messages: enhancedMessages,
        temperature: 0.7,
        max_tokens: MAX_OUTPUT_TOKENS,
      }),
    });

    const data = await apiResponse.json();

    if (apiResponse.ok) {
      return res.status(200).json({ ...data, remaining: creditsRemaining });
    } else {
      if (userId && !isAdmin) await refundCredit(supabase, userId);
      return res.status(apiResponse.status).json({ error: data });
    }
  } catch (error) {
    console.error('DeepSeek error:', error);
    if (userId && !isAdmin) await refundCredit(supabase, userId);
    return res.status(500).json({ error: 'Failed to connect to AI server.' });
  }
}

// ─────────────────────────────────────────────────────────────
// Action: fetch-content (web page / YouTube transcript scraper)
// ─────────────────────────────────────────────────────────────
// NOTE: cheerio and youtube-transcript are loaded lazily, inside this
// handler, instead of as top-level static imports. A top-level import
// is resolved the instant the serverless function cold-starts — for
// EVERY action, not just this one. If either package were ever missing
// or broken, it would crash 'chat' and 'analyze-pdf' too (which is
// exactly what happened: "Cannot find module 'cheerio'" took down the
// whole file). Lazy-loading confines the blast radius to this action.
//
// 🔒 CHANGED: added a DB-backed per-IP daily cap (this had none at
// all before — it was an open URL/YouTube fetcher for anyone), and
// switched to safeFetch() so redirects can't be used to reach
// blocked hosts.

async function handleFetchContent(req, res) {
  const { url } = req.body || {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid url in request body' });
  }

  if (!isSafeUrl(url)) {
    return res.status(400).json({ error: 'Invalid or blocked URL (SSRF protection)' });
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const ip = getClientIp(req);
  const keyHash = hashKey('fetch-content', ip);
  const { data: limitData, error: limitError } = await supabase.rpc('consume_anonymous_request', {
    p_key_hash: keyHash,
    p_max_per_window: 30,
  });
  if (limitError) {
    console.error('consume_anonymous_request error:', limitError);
    return res.status(500).json({ error: 'Could not verify usage. Please try again.' });
  }
  if (!limitData?.[0]?.success) {
    return res.status(429).json({ error: 'Too many fetch requests today. Please try again tomorrow.' });
  }

  try {
    const youtubeId = extractYouTubeId(url);
    let rawText = '';
    let sourceType = 'web';

    if (youtubeId) {
      sourceType = 'youtube';
      const { YoutubeTranscript } = await import('youtube-transcript');
      const transcript = await YoutubeTranscript.fetchTranscript(youtubeId);
      if (!transcript || transcript.length === 0) {
        return res.status(404).json({ error: 'No transcript found for this video.' });
      }
      rawText = transcript.map((t) => t.text).join(' ').replace(/\s+/g, ' ').trim();
    } else {
      const response = await safeFetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; vAIbes/1.0)', Accept: 'text/html' },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        return res.status(400).json({ error: `Could not fetch page (${response.status})` });
      }
      const html = await response.text();
      const cheerio = await import('cheerio');
      const $ = cheerio.load(html);
      $('script, style, nav, footer, header, noscript, iframe').remove();
      rawText = $('body').text().replace(/\s+/g, ' ').trim();
    }

    const originalWords = rawText.match(/\S+/g) || [];
    const originalWordCount = originalWords.length;
    const wasTruncated = originalWordCount > MAX_WORDS;
    const finalWords = wasTruncated ? originalWords.slice(0, MAX_WORDS) : originalWords;

    return res.status(200).json({
      text: finalWords.join(' ') + (wasTruncated ? '...' : ''),
      wordCount: finalWords.length,
      originalWordCount,
      wasTruncated,
      sourceType,
      sourceUrl: url,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
    console.error('Fetch error:', errorMsg || err);

    if (errorMsg.includes('cannot find module')) {
      return res.status(500).json({ error: 'Content-fetching dependency missing on the server. Check package.json.' });
    }
    if (errorMsg.includes('disabled') || errorMsg.includes('not available')) {
      return res.status(404).json({ error: 'Transcripts are disabled or unavailable for this video.' });
    }
    if (errorMsg.includes('ssrf')) {
      return res.status(400).json({ error: 'Invalid or blocked URL (SSRF protection)' });
    }

    return res.status(500).json({ error: 'Failed to fetch content. The source may block external requests.' });
  }
}

// ─────────────────────────────────────────────────────────────
// Action: analyze-pdf
// ─────────────────────────────────────────────────────────────
// 🔒 FIXED (earlier pass): auth now actually verifies the bearer
// token against Supabase instead of just checking a header exists.
//
// 🔒 FIXED (this pass): this used to send the first 8000 characters
// of raw base64 PDF *bytes* to DeepSeek as if it were readable text.
// Base64 is encoded binary — the model was reading noise, not the
// document. Now the PDF is actually parsed server-side (unpdf, a
// serverless-friendly wrapper around PDF.js) and real extracted
// text is sent instead.
//
// Handles text-layer PDFs. Scanned/image-only PDFs have no text
// layer to pull — those get a clear error instead of a near-empty,
// silently-bad answer. OCR is a separate, heavier piece of work,
// deliberately out of scope here.

async function handleAnalyzePdf(req, res) {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });

  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid or expired token.' });

  const isAdmin = user.email === ADMIN_EMAIL;
  let creditsRemaining = null;

  if (!isAdmin) {
    const { data, error } = await supabase.rpc('consume_ai_credit', {
      p_user_id: user.id,
      p_rate_limit_per_minute: RATE_LIMIT_PER_MINUTE,
    });
    if (error) {
      console.error('consume_ai_credit error:', error);
      return res.status(500).json({ error: 'Could not verify your credit balance. Please try again.' });
    }
    const result = data?.[0];
    if (!result?.success) {
      if (result?.reason === 'rate_limited') {
        return res.status(429).json({ error: `Too many requests — max ${RATE_LIMIT_PER_MINUTE}/minute.` });
      }
      return res.status(402).json({ error: 'No AI credits remaining. Please top up to continue.', code: 'NO_CREDITS' });
    }
    creditsRemaining = result.remaining;
  }

  const { pdfBase64, filename, mode, extraPrompt } = req.body;
  if (!pdfBase64) {
    if (!isAdmin) await refundCredit(supabase, user.id);
    return res.status(400).json({ error: 'Missing PDF data' });
  }

  let pdfBuffer;
  try {
    pdfBuffer = Buffer.from(pdfBase64, 'base64');
  } catch {
    if (!isAdmin) await refundCredit(supabase, user.id);
    return res.status(400).json({ error: 'Invalid PDF data.' });
  }

  if (pdfBuffer.length === 0) {
    if (!isAdmin) await refundCredit(supabase, user.id);
    return res.status(400).json({ error: 'Missing PDF data' });
  }
  if (pdfBuffer.length > MAX_PDF_BYTES) {
    if (!isAdmin) await refundCredit(supabase, user.id);
    return res.status(413).json({ error: 'PDF must be under 10MB.' });
  }

  // ── Extract real text (was: raw base64 slice) ──
  let extractedText = '';
  let wasTruncated = false;
  try {
    const { getDocumentProxy, extractText } = await import('unpdf');

    const pdf = await getDocumentProxy(new Uint8Array(pdfBuffer), {
      maxImageSize: 16_777_216, // ~16MP cap per declared image — untrusted-input guard, per unpdf's own docs
    });

    if (pdf.numPages > MAX_PDF_PAGES) {
      if (!isAdmin) await refundCredit(supabase, user.id);
      return res.status(413).json({
        error: `This PDF has ${pdf.numPages} pages — please try a document under ${MAX_PDF_PAGES} pages, or a shorter excerpt.`,
      });
    }

    const extractPromise = extractText(pdf, { mergePages: true });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('PDF extraction timed out')), PDF_EXTRACT_TIMEOUT_MS)
    );
    const { text } = await Promise.race([extractPromise, timeoutPromise]);

    extractedText = (text || '').trim();
  } catch (err) {
    console.error('PDF extraction error:', err);
    if (!isAdmin) await refundCredit(supabase, user.id);
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (msg.includes('cannot find module')) {
      return res.status(500).json({ error: 'PDF-parsing dependency missing on the server. Check package.json.' });
    }
    if (msg.includes('timed out')) {
      return res.status(504).json({ error: 'This PDF took too long to process — try a shorter document.' });
    }
    return res.status(400).json({ error: 'Could not read this PDF. It may be corrupted or password-protected.' });
  }

  // Scanned/image-only PDFs have no text layer — nothing meaningful to extract.
  if (extractedText.length < 50) {
    if (!isAdmin) await refundCredit(supabase, user.id);
    return res.status(422).json({
      error: "No readable text found in this PDF — it looks like a scanned or image-only document, which isn't supported yet.",
    });
  }

  if (extractedText.length > MAX_PDF_CHARS) {
    extractedText = extractedText.slice(0, MAX_PDF_CHARS);
    wasTruncated = true;
  }

  const modePrompts = {
    analyze: 'Analyze this document thoroughly. Identify key arguments, patterns, strengths, weaknesses, and insights. Be direct and specific.',
    summarize: 'Summarize this document. Extract the most important points a student needs to know. Use bullet points, flag likely exam topics with ⚡, end with the core idea in one sentence.',
    explain: 'Explain the content of this document clearly and simply. Use analogies where helpful. Make it accessible to a student encountering this topic for the first time.',
  };

  const systemPrompt = modePrompts[mode] || modePrompts.analyze;
  const userIntro = extraPrompt ? `${extraPrompt}\n\nHere is the document:` : 'Please process the attached document:';
  const truncatedNote = wasTruncated
    ? `\n\n[Note: this document is longer than fits here — only the first ${MAX_PDF_CHARS.toLocaleString()} characters are included below.]`
    : '';

  const useThinking = mode === 'analyze';

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        thinking: { type: useThinking ? 'enabled' : 'disabled' },
        max_tokens: useThinking ? 4000 : 2000,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `${userIntro}${truncatedNote}\n\n[Document: ${filename || 'untitled.pdf'}]\n\n${extractedText}`,
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('DeepSeek error:', data);
      if (!isAdmin) await refundCredit(supabase, user.id);
      return res.status(response.status).json({ error: data.error?.message || 'AI processing failed' });
    }

    return res.status(200).json({ ...data, remaining: creditsRemaining });
  } catch (err) {
    console.error('analyze-pdf error:', err);
    if (!isAdmin) await refundCredit(supabase, user.id);
    return res.status(500).json({ error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action } = req.body || {};

  switch (action) {
    case 'chat':
      return handleChat(req, res);
    case 'fetch-content':
      return handleFetchContent(req, res);
    case 'analyze-pdf':
      return handleAnalyzePdf(req, res);
    default:
      return res.status(400).json({
        error: 'Invalid or missing action. Use one of: chat, fetch-content, analyze-pdf',
      });
  }
}