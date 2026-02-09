import axios from 'axios';

export const fetchAIResponse = async (question) => {
  console.log('📝 Processing question:', question.substring(0, 50));
  
  try {
    console.log('🚀 Calling backend API...');
    const response = await axios.post('/api/compare', {
      question
    }, {
      timeout: 30000
    });

    if (!response.data.success) {
      throw new Error('Failed to get AI response');
    }

    console.log('✅ Backend API Success!');
    const responseText = response.data.data;
    
    return parseAIResponse(responseText, question);
    
  } catch (error) {
    console.error('❌ Backend API Error:', error.message);
    console.log('🔄 Falling back to enhanced demo');
    return getEnhancedDemoResponses(question);
  }
};

// Parse AI response into three perspectives
const parseAIResponse = (responseText, question) => {
  console.log('🔍 Parsing AI response...');
  
  // Try to extract sections based on markers
  const sections = {
    analytical: extractSection(responseText, ['ANALYTICAL', '1.', 'analytical']),
    simplified: extractSection(responseText, ['SIMPLIFIED', '2.', 'simplified', 'simple']),
    critical: extractSection(responseText, ['CRITICAL', '3.', 'critical'])
  };
  
  // If parsing fails, use the whole response
  if (!sections.analytical || !sections.simplified || !sections.critical) {
    console.log('⚠️ Could not parse all sections, using fallback');
    const third = Math.floor(responseText.length / 3);
    return [
      {
        name: 'Analytical Perspective',
        description: 'Data-driven, logical reasoning',
        color: '#6a5cff',
        icon: '📊',
        text: responseText.substring(0, third) || `Analytical analysis: ${question}`
      },
      {
        name: 'Simplified Perspective',
        description: 'Plain language, beginner-friendly',
        color: '#00e5ff',
        icon: '💡',
        text: responseText.substring(third, third * 2) || `Simple explanation: ${question}`
      },
      {
        name: 'Critical Perspective',
        description: 'Question assumptions, explore nuances',
        color: '#ff4fd8',
        icon: '🔍',
        text: responseText.substring(third * 2) || `Critical view: ${question}`
      }
    ];
  }
  
  return [
    {
      name: 'Analytical Perspective',
      description: 'Data-driven, logical reasoning',
      color: '#6a5cff',
      icon: '📊',
      text: sections.analytical
    },
    {
      name: 'Simplified Perspective',
      description: 'Plain language, beginner-friendly',
      color: '#00e5ff',
      icon: '💡',
      text: sections.simplified
    },
    {
      name: 'Critical Perspective',
      description: 'Question assumptions, explore nuances',
      color: '#ff4fd8',
      icon: '🔍',
      text: sections.critical
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
    
    // Check if this line starts a new section
    if (keywords.some(keyword => line.includes(keyword.toLowerCase()))) {
      if (inSection) {
        break;
      }
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
  console.log('🎭 Generating fallback responses...');
  
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        {
          name: 'Analytical Perspective',
          description: 'Data-driven, logical reasoning',
          color: '#6a5cff',
          icon: '📊',
          text: `Unable to fetch live response right now. This could be due to API rate limits or connectivity issues. Please try again in a moment.`
        },
        {
          name: 'Simplified Perspective',
          description: 'Plain language, beginner-friendly',
          color: '#00e5ff',
          icon: '💡',
          text: `Demo response unavailable. Our AI service is temporarily offline. We apologize for the inconvenience.`
        },
        {
          name: 'Critical Perspective',
          description: 'Question assumptions, explore nuances',
          color: '#ff4fd8',
          icon: '🔍',
          text: `We're experiencing issues delivering real responses. Thank you for your patience while we resolve this.`
        }
      ]);
    }, 800);
  });
};