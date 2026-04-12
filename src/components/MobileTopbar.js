import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import AuthModal from './AuthModal';
import SettingsModal from './SettingsModal';
import StudyMode from './StudyMode';

const MobileTopbar = () => {
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSettings,  setShowSettings]  = useState(false);
  const [showModels,    setShowModels]    = useState(false);

  const avatarUrl   = user?.user_metadata?.avatar_url;
  const displayName = user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || user?.email?.split('@')[0];

  const allTools = [
    { name: 'Grok',       url: 'https://grok.com',                color: 'grok' },
    { name: 'ChatGPT',    url: 'https://chat.openai.com',         color: 'chatgpt' },
    { name: 'Gemini',     url: 'https://gemini.google.com',       color: 'gemini' },
    { name: 'DeepSeek',   url: 'https://chat.deepseek.com',       color: 'deepseek' },
    { name: 'Claude',     url: 'https://claude.ai',               color: 'claude' },
    { name: 'Qwen',       url: 'https://chat.qwen.ai',            color: 'qwen' },
    { name: 'Kimi',       url: 'https://kimi.moonshot.cn',        color: 'kimi' },
    { name: 'Perplexity', url: 'https://www.perplexity.ai',       color: 'perplexity' },
    { name: 'Google',     url: 'https://www.google.com',          color: 'google' },
    { name: 'Wikipedia',  url: 'https://www.wikipedia.org',       color: 'wiki' },
  ];

  return (
    <>
      {/* ═══════════ TOPBAR ═══════════ */}
      <div className="mobile-topbar">

        {/* Left: Brand */}
        <div className="mobile-brand">
          <img src="hero.ai.png" alt="vAIbes" className="mobile-brand-logo" />
          <span className="mobile-brand-name">vAIbes</span>
        </div>

        {/* Right: Actions */}
        <div className="mobile-topbar-right">

          {/* Theme toggle */}
          <button className="mobile-icon-btn" onClick={toggleTheme} title="Toggle theme">
            {isDark ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1"  x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22"  y1="4.22"  x2="5.64"  y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1"  y1="12" x2="3"  y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22"  y1="19.78" x2="5.64"  y2="18.36"/>
                <line x1="18.36" y1="5.64"  x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>

          {/* AI Models button */}
          <button className="mobile-icon-btn" onClick={() => setShowModels(true)} title="AI Models">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <line x1="8"  y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </button>

          {/* Auth */}
          {user ? (
            <div onClick={() => setShowSettings(true)} style={{ cursor: 'pointer' }}>
              {avatarUrl
                ? <img src={avatarUrl} alt="avatar" className="mobile-avatar" />
                : <div className="mobile-avatar-placeholder">
                    {displayName?.charAt(0).toUpperCase()}
                  </div>
              }
            </div>
          ) : (
            <button className="login-btn" onClick={() => setShowAuthModal(true)}
              style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}>
              Sign In
            </button>
          )}
        </div>
      </div>

      {/* ═══════════ STUDY MODE — ALWAYS MOUNTED (never unmounts) ═══════════
          Music continues playing even when the internal panel is closed. */}
      <div style={{
        position: 'sticky',
        top: '56px',
        zIndex: 199,
        padding: '0.5rem 1rem',
        background: 'rgba(10, 10, 20, 0.97)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(106, 92, 255, 0.2)',
      }}>
        <StudyMode />
      </div>

      {/* ═══════════ AI MODELS DRAWER ═══════════ */}
      {showModels && (
        <>
          <div className="mobile-drawer-overlay" onClick={() => setShowModels(false)} />
          <div className="mobile-drawer-right">
            <div className="mobile-drawer-header">
              <span>AI Models & Sources</span>
              <button className="mobile-drawer-close" onClick={() => setShowModels(false)}>✕</button>
            </div>
            <div className="mobile-drawer-content">
              {allTools.map((tool, i) => (
                <a key={i} href={tool.url} target="_blank" rel="noopener noreferrer"
                  className={`drawer-item tool-${tool.color}`}
                  onClick={() => setShowModels(false)}>
                  {tool.name}
                </a>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ═══════════ SETTINGS ═══════════ */}
      {showSettings && (
        <>
          <div className="profile-overlay" onClick={() => setShowSettings(false)} />
          <div className="profile-panel-wrapper">
            <SettingsModal onClose={() => setShowSettings(false)} />
          </div>
        </>
      )}

      {/* ═══════════ AUTH ═══════════ */}
      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}
    </>
  );
};

export default MobileTopbar;