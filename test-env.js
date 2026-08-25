// test-env.js
require('dotenv').config({ path: '.env.local' });

console.log('=== TESTING ENVIRONMENT VARIABLES ===');
console.log('REACT_APP_OPENAI_API_KEY exists:', !!process.env.REACT_APP_OPENAI_API_KEY);
console.log('Key starts with:', process.env.REACT_APP_OPENAI_API_KEY ? 
  process.env.REACT_APP_OPENAI_API_KEY.substring(0, 10) + '...' : 'NOT FOUND');
console.log('Key length:', process.env.REACT_APP_OPENAI_API_KEY?.length || 0);
console.log('=====================================');