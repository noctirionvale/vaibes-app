export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ error: 'Missing videoId' });

  try {
    // Step 1: Fetch YouTube page with proper headers
    const pageRes = await fetch(
      `https://www.youtube.com/watch?v=${videoId}&hl=en`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
        }
      }
    );

    const html = await pageRes.text();

    // Step 2: Try multiple regex patterns for caption tracks
    let captionTracks = null;

    // Pattern 1: standard
    const match1 = html.match(/"captionTracks":\s*(\[.*?\])/);
    if (match1) {
      try { captionTracks = JSON.parse(match1[1]); } catch(e) {}
    }

    // Pattern 2: inside playerCaptionsTracklistRenderer
    if (!captionTracks) {
      const match2 = html.match(/"playerCaptionsTracklistRenderer":\s*\{.*?"captionTracks":\s*(\[.*?\])/s);
      if (match2) {
        try { captionTracks = JSON.parse(match2[1]); } catch(e) {}
      }
    }

    // Pattern 3: ytInitialPlayerResponse
    if (!captionTracks) {
      const match3 = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;/s);
      if (match3) {
        try {
          const playerResponse = JSON.parse(match3[1]);
          captionTracks = playerResponse
            ?.captions
            ?.playerCaptionsTracklistRenderer
            ?.captionTracks;
        } catch(e) {}
      }
    }

    if (!captionTracks || captionTracks.length === 0) {
      return res.status(404).json({
        error: 'No captions found for this video. Try a video with CC/subtitles enabled.'
      });
    }

    // Step 3: Pick best track — prefer English
    const track = 
      captionTracks.find(t => t.languageCode === 'en') ||
      captionTracks.find(t => t.languageCode?.startsWith('en')) ||
      captionTracks[0];

    if (!track?.baseUrl) {
      return res.status(404).json({
        error: 'No suitable caption track found.'
      });
    }

    // Step 4: Fetch caption XML
    const captionRes = await fetch(track.baseUrl + '&fmt=json3');
    
    let fullText = '';

    if (captionRes.ok) {
      // Try JSON format first
      try {
        const captionJson = await captionRes.json();
        fullText = captionJson.events
          ?.filter(e => e.segs)
          ?.map(e => e.segs.map(s => s.utf8).join(''))
          ?.join(' ')
          ?.replace(/\s+/g, ' ')
          ?.trim() || '';
      } catch(e) {
        // Fallback to XML
        const xmlRes = await fetch(track.baseUrl);
        const xml = await xmlRes.text();
        fullText = xml
          .match(/<text[^>]*>(.*?)<\/text>/gs)
          ?.map(m => m
            .replace(/<[^>]*>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim()
          )
          ?.join(' ') || '';
      }
    }

    if (!fullText) {
      return res.status(404).json({
        error: 'Transcript was empty. Please try another video.'
      });
    }

    // Step 5: Truncate safely
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