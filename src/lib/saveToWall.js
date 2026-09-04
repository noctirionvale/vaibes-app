// src/lib/saveToWall.js
//
// Shared helper for saving a new card to the user's Wall (user_creatives table),
// optionally uploading an image to Supabase Storage first.
//
// Schema is now based on how UserWall.jsx actually reads these rows, not a
// guess:
//   - Images live in an `attachments` array field — UserWall's getCardType()
//     checks item.attachments?.some(a => a.type?.startsWith('image/')), and
//     renders a.url / a.name. There's no separate image_url/media_url column.
//   - `media_type: 'note'` matches what VaibeyContext filters on, and is
//     independent of whether an image is attached — UserWall's getCardType()
//     still resolves a card with an image attachment to 'image' regardless
//     of media_type, so this keeps it visible to Vaibey's context AND
//     correctly filed under the Wall's "Image" filter chip.
//   - `content` is only wrapped in <p> if it isn't already HTML — this
//     matches the same startsWith('<') check UserWall.jsx uses, so passing
//     pre-rendered HTML (e.g. via renderMarkdown) doesn't get double-wrapped.
//
// Bucket: 'creatives' — the one in Storage that lines up with the table name
// and already has files in it. Change if that's not actually right.

export async function saveToWall(supabase, user, { title, content, imageFile }) {
  if (!user?.id) throw new Error('saveToWall: no authenticated user');

  let attachment = null;

  if (imageFile) {
    try {
      const ext = imageFile.name.split('.').pop() || 'jpg';
      const path = `${user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase
        .storage
        .from('creatives')
        .upload(path, imageFile);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('creatives').getPublicUrl(path);
      if (data?.publicUrl) {
        attachment = { type: imageFile.type || 'image/jpeg', url: data.publicUrl, name: imageFile.name };
      }
    } catch (err) {
      console.error('[saveToWall] image upload failed, saving without image:', err);
      attachment = null; // non-blocking — still save the text card
    }
  }

  const trimmedTitle = title?.trim();
  const fallbackTitle = content.length > 60 ? content.slice(0, 60) + '…' : content;
  const looksLikeHtml = content.trim().startsWith('<');

  const baseRow = {
    user_id: user.id,
    title: trimmedTitle || fallbackTitle,
    content: looksLikeHtml ? content : `<p>${content}</p>`,
    media_type: 'note',
  };

  const row = attachment ? { ...baseRow, attachments: [attachment] } : baseRow;

  const { error } = await supabase.from('user_creatives').insert(row);
  if (error) {
    if (attachment) {
      console.error('[saveToWall] insert with attachments failed — retrying as a plain text card:', error);
      const { error: retryError } = await supabase.from('user_creatives').insert(baseRow);
      if (retryError) throw retryError;
    } else {
      throw error;
    }
  }

  return { imageUrl: attachment?.url || null };
}