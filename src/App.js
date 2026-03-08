import React from 'react';
import Sidebar from './components/Sidebar';
import Hero from './components/Hero';
import AIComparison from './components/AIComparison';
import './styles/App.css';
// Notice we deleted: import Footer from './components/Footer';

function App() {
  const leftSidebarItems = [
    { name: 'Grok', url: 'https://grok.com', desc: 'Alternative viewpoints and challenging assumptions', color: 'grok' },
    { name: 'ChatGPT', url: 'https://chat.openai.com', desc: 'General explanations and structured answers', color: 'chatgpt' },
    { name: 'Gemini', url: 'https://gemini.google.com', desc: 'Broad knowledge and access to recent information', color: 'gemini' },
    { name: 'Perplexity', url: 'https://www.perplexity.ai', desc: 'Source-backed answers and live information', color: 'perplexity' },
    { name: 'Google', url: 'https://www.google.com', desc: 'Discovering additional sources and viewpoints', color: 'google' }
  ];

  const rightSidebarItems = [
    { name: 'DeepSeek', url: 'https://chat.deepseek.com', desc: 'Technical and analytical responses', color: 'deepseek' },
    { name: 'Claude', url: 'https://claude.ai', desc: 'Clear, thoughtful writing and summaries', color: 'claude' },
    { name: 'Qwen', url: 'https://chat.qwen.ai', desc: 'Multilingual reasoning and diverse perspectives', color: 'qwen' },
    { name: 'Kimi', url: 'https://kimi.moonshot.cn', desc: 'Long-context processing and detailed document analysis', color: 'kimi' },
    { name: 'Wikipedia', url: 'https://www.wikipedia.org', desc: 'Background knowledge and established facts', color: 'wiki' }
  ];

  return (
    <div className="main-wrapper">
      <Sidebar items={leftSidebarItems} isRight={false} />
      
      <main className="content-center">
        <div className="auth-container">
          <button className="login-btn">
            {/* An elegant user profile SVG icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <span>Sign In</span>
          </button>
        </div>
        <Hero />
        
        <AIComparison />
        
        {/* The <Footer /> component has been removed from here! */}
      </main>

      <Sidebar items={rightSidebarItems} isRight={true} />
    </div>
  );
}

export default App;