import { YoutubeTranscript } from 'youtube-transcript';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ error: 'Missing videoId' });

  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    
    const fullText = transcript
      .map(chunk => chunk.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Safety truncation for token limits
    const words = fullText.split(' ');
    const safeText = words.length > 12000
      ? words.slice(0, 12000).join(' ') + '... [transcript truncated]'
      : fullText;

    return res.status(200).json({ transcript: safeText });

  } catch (error) {
    return res.status(500).json({
      error: 'Could not fetch transcript. This video may have captions disabled.'
    });
  }
}