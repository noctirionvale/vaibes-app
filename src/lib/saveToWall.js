// src/lib/saveToWall.js
//
// Shared helper for saving a card to the user's Wall (user_creatives table),
// with optional media attachments uploaded to Supabase Storage first.
// Supports any number of images/videos, not just a single image.

export async function saveToWall(supabase, user, { title, content, mediaFiles = [] }) {
  if (!user?.id) throw new Error('saveToWall: no authenticated user');

  const attachments = [];

  for (const file of mediaFiles) {
    try {
      const ext = file.name.split('.').pop() || (file.type.startsWith('video/') ? 'mp4' : 'jpg');
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: uploadError } = await supabase.storage.from('creatives').upload(path, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('creatives').getPublicUrl(path);
      if (data?.publicUrl) {
        attachments.push({ type: file.type || 'application/octet-stream', url: data.publicUrl, name: file.name });
      }
    } catch (err) {
      console.error('[saveToWall] one attachment failed to upload, skipping it:', err);
      // non-blocking — keep going, save what did succeed
    }
  }

  const trimmedTitle = title?.trim();
  const plainForFallback = content.replace(/<[^>]*>/g, '');
  const fallbackTitle = plainForFallback.length > 60 ? plainForFallback.slice(0, 60) + '…' : plainForFallback;
  const looksLikeHtml = content.trim().startsWith('<');

  const baseRow = {
    user_id: user.id,
    title: trimmedTitle || fallbackTitle || 'Untitled',
    content: looksLikeHtml ? content : `<p>${content}</p>`,
    // UserWall's getCardType() checks media_type === 'video' first, so tag
    // it correctly when a video was attached; images still resolve to
    // 'image' via the attachments check regardless of media_type.
    media_type: attachments.some(a => a.type.startsWith('video/')) ? 'video' : 'note',
  };

  const row = attachments.length > 0 ? { ...baseRow, attachments } : baseRow;

  const { error } = await supabase.from('user_creatives').insert(row);
  if (error) {
    if (attachments.length > 0) {
      console.error('[saveToWall] insert with attachments failed — retrying as a plain text card:', error);
      const { error: retryError } = await supabase.from('user_creatives').insert(baseRow);
      if (retryError) throw retryError;
    } else {
      throw error;
    }
  }

  return { attachmentUrls: attachments.map(a => a.url) };
}