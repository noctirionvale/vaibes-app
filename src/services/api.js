import axios from 'axios';

// Configuration for text limits
const TEXT_LIMITS = {
  questionMax: 500,      // Max characters for user question
  responseMax: 800,      // Max characters per perspective
  showTruncated: true    // Show "..." if truncated
};

export const fetchAIResponse = async (question) => {
  console.log('📝 Processing question:', question.substring(0, 50));
  
  // Validate question length
  if (question.length > TEXT_LIMITS.questionMax) {
    throw new Error(`Question must be under ${TEXT_LIMITS.questionMax} characters`);
  }
  
  const maxRetries = 3;
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🚀 Calling backend API... (Attempt ${attempt}/${maxRetries})`);
      
      const response = await axios.post('/api/compare', {
        question
      }, {
        timeout: 60000
      });

      if (!response.data.success) {
        throw new Error('Failed to get response from Deepseek');
      }

      console.log('✅ Backend API Success!');
      const responseText = response.data.data;
      
      return parseDeepseekResponse(responseText, question);
      
    } catch (error) {
      lastError = error;
      console.error(`❌ Attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        console.log(`🔄 Retrying... (${maxRetries - attempt} attempts remaining)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  
  console.log('🔄 All retries failed, falling back to demo');
  return getEnhancedDemoResponses(question);
};

// Truncate text to max length
const truncateText = (text, maxLength = TEXT_LIMITS.responseMax) => {
  if (text.length <= maxLength) return text;
  
  let truncated = text.substring(0, maxLength);
  
  // Try to cut at last sentence/period
  const lastPeriod = truncated.lastIndexOf('.');
  const lastNewline = truncated.lastIndexOf('\n');
  const lastBreak = Math.max(lastPeriod, lastNewline);
  
  if (lastBreak > maxLength * 0.7) {
    truncated = truncated.substring(0, lastBreak + 1);
  }
  
  if (TEXT_LIMITS.showTruncated) {
    truncated += ' ...';
  }
  
  return truncated;
};

// Parse Deepseek response into three perspectives
const parseDeepseekResponse = (responseText, question) => {
  console.log('🔍 Parsing Deepseek response...');
  
  const sections = {
    analytical: extractSection(responseText, ['ANALYTICAL', '1.', 'analytical']),
    simplified: extractSection(responseText, ['SIMPLIFIED', '2.', 'simplified', 'simple']),
    critical: extractSection(responseText, ['CRITICAL', '3.', 'critical'])
  };
  
  // If parsing fails, split response into thirds
  if (!sections.analytical || !sections.simplified || !sections.critical) {
    console.log('⚠️ Could not parse all sections, using fallback');
    const third = Math.floor(responseText.length / 3);
    return [
      {
        name: 'Analytical Perspective',
        description: 'Data-driven, logical reasoning',
        color: '#6a5cff',
        icon: '📊',
        text: truncateText(responseText.substring(0, third) || `Analytical analysis: ${question}`)
      },
      {
        name: 'Simplified Perspective',
        description: 'Plain language, beginner-friendly',
        color: '#00e5ff',
        icon: '💡',
        text: truncateText(responseText.substring(third, third * 2) || `Simple explanation: ${question}`)
      },
      {
        name: 'Critical Perspective',
        description: 'Question assumptions, explore nuances',
        color: '#ff4fd8',
        icon: '🔍',
        text: truncateText(responseText.substring(third * 2) || `Critical view: ${question}`)
      }
    ];
  }
  
  return [
    {
      name: 'Analytical Perspective',
      description: 'Data-driven, logical reasoning',
      color: '#6a5cff',
      icon: '📊',
      text: truncateText(sections.analytical)
    },
    {
      name: 'Simplified Perspective',
      description: 'Plain language, beginner-friendly',
      color: '#00e5ff',
      icon: '💡',
      text: truncateText(sections.simplified)
    },
    {
      name: 'Critical Perspective',
      description: 'Question assumptions, explore nuances',
      color: '#ff4fd8',
      icon: '🔍',
      text: truncateText(sections.critical)
    }
  ];
};

// Helper to extract section from response
const extractSection = (text, keywords) => {
  const lines = text.split('\n');
  let inSection = false;
  let sectionText = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    
    if (keywords.some(keyword => line.includes(keyword.toLowerCase()))) {
      if (inSection) break;
      inSection = true;
      continue;
    }
    
    if (inSection) {
      if (sectionText.length === 0 && !line.trim()) {
        continue;
      }
      sectionText.push(lines[i]);
      
      if (i + 1 < lines.length && 
          (lines[i + 1].match(/^\d+\./) || 
           lines[i + 1].match(/^[A-Z\s]+:$/) ||
           lines[i + 1].toUpperCase() === lines[i + 1])) {
        break;
      }
    }
  }
  
  return sectionText.join('\n').trim() || null;
};

// Enhanced demo responses (fallback)
const getEnhancedDemoResponses = (question) => {
  console.log('🎭 Generating enhanced demo responses...');
  
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        {
          name: 'Analytical Perspective',
          description: 'Data-driven, logical reasoning',
          color: '#6a5cff',
          icon: '📊',
          text: `[DEMO MODE] Backend server may not be running. Make sure you ran: npm install express cors dotenv concurrently. Then restart with: npm start. Analytical view of: "${question}"`
        },
        {
          name: 'Simplified Perspective',
          description: 'Plain language, beginner-friendly',
          color: '#00e5ff',
          icon: '💡',
          text: `[DEMO MODE] Backend should be running on localhost:5000. Check terminal for errors and make sure all dependencies are installed. Simple explanation of: "${question}"`
        },
        {
          name: 'Critical Perspective',
          description: 'Question assumptions, explore nuances',
          color: '#ff4fd8',
          icon: '🔍',
          text: `[DEMO MODE] If you see this, the backend API call failed. Check: 1. Is node server.js running? 2. Do you have DEEPSEEK_API_KEY in .env? 3. Check browser console for errors. Critical view: "${question}"`
        }
      ]);
    }, 800);
  });
};

// Export config so component can use it
export { TEXT_LIMITS };