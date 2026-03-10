import React from 'react';
import LeftSidebar from './components/LeftSidebar';
import Sidebar from './components/Sidebar';
import AIComparison from './components/AIComparison';
import './styles/App.css';

function App() {
  // All 10 tools beautifully combined into one master array
  const allTools = [
    { name: 'Grok', url: 'https://grok.com', desc: 'Alternative viewpoints', color: 'grok' },
    { name: 'ChatGPT', url: 'https://chat.openai.com', desc: 'General explanations', color: 'chatgpt' },
    { name: 'Gemini', url: 'https://gemini.google.com', desc: 'Broad knowledge', color: 'gemini' },
    { name: 'DeepSeek', url: 'https://chat.deepseek.com', desc: 'Technical responses', color: 'deepseek' },
    { name: 'Claude', url: 'https://claude.ai', desc: 'Thoughtful writing', color: 'claude' },
    { name: 'Qwen', url: 'https://chat.qwen.ai', desc: 'Multilingual reasoning', color: 'qwen' },
    { name: 'Kimi', url: 'https://kimi.moonshot.cn', desc: 'Document analysis', color: 'kimi' },
    { name: 'Perplexity', url: 'https://www.perplexity.ai', desc: 'Source-backed answers', color: 'perplexity' },
    { name: 'Google', url: 'https://www.google.com', desc: 'Discovering sources', color: 'google' },
    { name: 'Wikipedia', url: 'https://www.wikipedia.org', desc: 'Established facts', color: 'wiki' }
  ];

  return (
    <div className="main-wrapper">
      
      {/* 1. Left Column: Brand & Info */}
      <LeftSidebar />
      
      {/* 2. Center Column: Pure Chatbox */}
      <main className="content-center">
        <div className="chatbox-wrapper">
          <AIComparison />
        </div>
      </main>

      {/* 3. Right Column: The Tool Drawer */}
      <Sidebar items={allTools} title="AI Models & Sources" />
      
    </div>
  );
}

export default App;