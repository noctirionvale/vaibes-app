import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { supabase } from './lib/supabase';
import LeftSidebar from './components/LeftSidebar';
import Sidebar from './components/Sidebar';
import AIComparison from './components/AIComparison';
import MobileTopbar from './components/MobileTopbar';
import LandingPage from './components/LandingPage';
import './styles/App.css';

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

const AppShell = () => {
  useEffect(() => {
    supabase.auth.getSession();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(reg => reg.unregister());
      });
    }
  }, []);

  return (
    <>
      <MobileTopbar />
      <div className="main-wrapper">
        <LeftSidebar />
        <main className="content-center">
          <div className="chatbox-wrapper">
            <AIComparison />
          </div>
        </main>
        <Sidebar items={allTools} title="AI Models & Sources" />
      </div>
    </>
  );
};

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/app" element={<AppShell />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;