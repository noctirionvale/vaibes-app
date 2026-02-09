// /api/compare.js
import axios from 'axios';

export default async function handler(req, res) {
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { question } = req.body;

  try {
    const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'user',
          content: `Please provide three perspectives on this question: "${question}"\n\n1. ANALYTICAL: Data-driven, logical reasoning\n2. SIMPLIFIED: Plain language explanation\n3. CRITICAL: Question assumptions and nuances`
        }
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    const responseText = response.data.choices[0].message.content;

    return res.status(200).json({
      success: true,
      data: responseText
    });
  } catch (error) {
    console.error('Deepseek API error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}