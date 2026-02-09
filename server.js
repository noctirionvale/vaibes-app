const express = require('express');
const cors = require('cors');
require('dotenv').config();
const axios = require('axios');

const app = express();
app.use(express.json());
app.use(cors());

const DEEPSEEK_API_KEY = process.env.REACT_APP_DEEPSEEK_API_KEY;

console.log('🚀 Server starting...');
console.log('📝 DeepSeek API Key loaded:', !!DEEPSEEK_API_KEY);

// Endpoint to get AI responses
app.post('/api/compare', async (req, res) => {
  try {
    const { question } = req.body;

    if (!DEEPSEEK_API_KEY) {
      return res.status(400).json({ error: 'DeepSeek API key not configured' });
    }

    console.log('📨 Received question:', question.substring(0, 50));

    const response = await axios.post(
      'https://api.deepseek.com/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'You are an AI educator. Provide three distinct perspectives on topics.'
          },
          {
            role: 'user',
            content: `Provide three distinct perspectives on this topic:

TOPIC: "${question}"

Provide these three perspectives:

1. ANALYTICAL PERSPECTIVE:
   - Data-driven analysis
   - Logical breakdown
   - Key statistics or facts
   - Technical aspects

2. SIMPLIFIED PERSPECTIVE:
   - Beginner-friendly explanation
   - Simple analogies or metaphors
   - Clear, plain language
   - Practical examples

3. CRITICAL PERSPECTIVE:
   - Question assumptions
   - Explore limitations
   - Discuss biases or ethical concerns
   - Alternative viewpoints

Keep each perspective concise (100-150 words). Use clear section headings.`
          }
        ],
        temperature: 0.7,
        max_tokens: 800
      },
      {
        headers: {
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ DeepSeek API Success!');
    const responseText = response.data.choices[0].message.content;
    
    res.json({ 
      success: true,
      data: responseText 
    });

  } catch (error) {
    console.error('❌ DeepSeek API Error:', error.response?.data?.error?.message || error.message);
    res.status(500).json({ 
      error: error.response?.data?.error?.message || error.message 
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', deepseekConfigured: !!DEEPSEEK_API_KEY });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Backend server running on http://localhost:${PORT}`);
});