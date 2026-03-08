// /api/compare.js
import axios from 'axios';

export default async function handler(req, res) {
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { question } = req.body;
  const DEEPSEEK_API_KEY = process.env.REACT_APP_DEEPSEEK_API_KEY; // ← Change this line

  if (!DEEPSEEK_API_KEY) {
    return res.status(400).json({ error: 'API key not configured' });
  }

  try {
    const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'user',
          content: question
        }
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`, // ← Use the variable
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