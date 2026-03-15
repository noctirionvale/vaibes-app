export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ error: 'Missing videoId' });

  try {
    // Use youtubetranscript.com API — free, no key needed
    const response = await fetch(
      `https://youtubetranscript.com/?server_vid2=${videoId}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json, text/plain, */*',
        }
      }
    );

    const text = await response.text();

    // Parse the XML response
    const textMatches = text.match(/<text[^>]*>(.*?)<\/text>/gs) || [];

    if (textMatches.length === 0) {
      return res.status(404).json({
        error: 'No captions found. Try a video with CC/subtitles enabled.'
      });
    }

    const fullText = textMatches
      .map(m => m
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n/g, ' ')
        .trim()
      )
      .filter(Boolean)
      .join(' ');

    const words = fullText.split(' ');
    const safeText = words.length > 12000
      ? words.slice(0, 12000).join(' ') + '... [transcript truncated]'
      : fullText;

    return res.status(200).json({ transcript: safeText });

  } catch (error) {
    console.error('Transcript error:', error.message);
    return res.status(500).json({
      error: 'Could not fetch transcript. Please try another video.'
    });
  }
}