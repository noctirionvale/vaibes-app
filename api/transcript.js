export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ error: 'Missing videoId' });

  try {
    // Step 1: Fetch the YouTube page
    const pageRes = await fetch(
      `https://www.youtube.com/watch?v=${videoId}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      }
    );

    const html = await pageRes.text();

    // Step 2: Extract caption URL from page data
    const captionMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
    
    if (!captionMatch) {
      return res.status(404).json({ 
        error: 'No captions found for this video. Try a video with CC/subtitles enabled.' 
      });
    }

    const captionTracks = JSON.parse(captionMatch[1]);
    
    // Prefer English captions
    const englishTrack = captionTracks.find(t => 
      t.languageCode === 'en' || t.languageCode === 'en-US'
    ) || captionTracks[0];

    if (!englishTrack?.baseUrl) {
      return res.status(404).json({ 
        error: 'No English captions available for this video.' 
      });
    }

    // Step 3: Fetch the actual caption XML
    const captionRes = await fetch(englishTrack.baseUrl);
    const captionXml = await captionRes.text();

    // Step 4: Parse XML to plain text
    const textMatches = captionXml.match(/<text[^>]*>(.*?)<\/text>/gs) || [];
    
    const fullText = textMatches
      .map(match => {
        return match
          .replace(/<[^>]*>/g, '')           // remove XML tags
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\n/g, ' ')
          .trim();
      })
      .filter(Boolean)
      .join(' ');

    if (!fullText) {
      return res.status(404).json({ 
        error: 'Transcript was empty. Please try another video.' 
      });
    }

    // Step 5: Truncate for token safety
    const words = fullText.split(' ');
    const safeText = words.length > 12000
      ? words.slice(0, 12000).join(' ') + '... [transcript truncated]'
      : fullText;

    return res.status(200).json({ transcript: safeText });

  } catch (error) {
    console.error('Transcript error:', error);
    return res.status(500).json({ 
      error: 'Could not fetch transcript. The video may have captions disabled.' 
    });
  }
}