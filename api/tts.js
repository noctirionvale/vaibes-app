export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { text, isPro } = req.body;
  if (!text) return res.status(400).json({ error: 'Missing text' });

  // Pro users get Neural2, free users get WaveNet
  const voiceName = isPro ? 'en-US-Neural2-F' : 'en-US-Wavenet-F';

  try {
    const response = await fetch(
      'https://texttospeech.googleapis.com/v1/text:synthesize?key=' + process.env.GOOGLE_TTS_API_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text: text.substring(0, 5000) },
          voice: {
            languageCode: 'en-US',
            name: voiceName
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 1.0,
            pitch: 0.0
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Google TTS error:', data);
      return res.status(500).json({ error: 'TTS generation failed' });
    }

    return res.status(200).json({
      audioContent: data.audioContent,
      voice: voiceName
    });

  } catch (error) {
    console.error('TTS error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}