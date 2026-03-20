export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { imageBase64, mimeType } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'Missing image' });

  try {
    const response = await fetch(
      'https://vision.googleapis.com/v1/images:annotate?key=' + process.env.GOOGLE_TTS_API_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: imageBase64 },
            features: [
              { type: 'LABEL_DETECTION', maxResults: 10 },
              { type: 'TEXT_DETECTION', maxResults: 1 },
              { type: 'OBJECT_LOCALIZATION', maxResults: 10 },
              { type: 'IMAGE_PROPERTIES', maxResults: 5 },
              { type: 'SAFE_SEARCH_DETECTION' }
            ]
          }]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Vision API error:', data);
      return res.status(500).json({ error: 'Vision analysis failed' });
    }

    const result = data.responses[0];

    // Check safe search
    const safeSearch = result.safeSearchAnnotation;
    if (
      safeSearch?.adult === 'LIKELY' || safeSearch?.adult === 'VERY_LIKELY' ||
      safeSearch?.violence === 'LIKELY' || safeSearch?.violence === 'VERY_LIKELY'
    ) {
      return res.status(400).json({ error: 'Image contains inappropriate content.' });
    }

    // Extract labels
    const labels = result.labelAnnotations
      ?.map(l => l.description)
      ?.join(', ') || '';

    // Extract text (OCR)
    const text = result.textAnnotations?.[0]?.description || '';

    // Extract objects
    const objects = result.localizedObjectAnnotations
      ?.map(o => o.name)
      ?.join(', ') || '';

    return res.status(200).json({
      labels,
      text,
      objects,
      summary: `Labels: ${labels}. ${objects ? 'Objects: ' + objects + '.' : ''} ${text ? 'Text found: ' + text : ''}`
    });

  } catch (error) {
    console.error('Vision error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}