import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import AuthModal from './AuthModal';
import ProfilePanel from './ProfilePanel';

const MobileTopbar = () => {
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showModels, setShowModels] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);

  const avatarUrl = user?.user_metadata?.avatar_url;
  const displayName = user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || user?.email?.split('@')[0];

  const allTools = [
    // ✅ FIX: Trimmed trailing spaces from URLs
    { name: 'Grok', url: 'https://grok.com', color: 'grok' },
    { name: 'ChatGPT', url: 'https://chat.openai.com', color: 'chatgpt' },
    { name: 'Gemini', url: 'https://gemini.google.com', color: 'gemini' },
    { name: 'DeepSeek', url: 'https://chat.deepseek.com', color: 'deepseek' },
    { name: 'Claude', url: 'https://claude.ai', color: 'claude' },
    { name: 'Qwen', url: 'https://chat.qwen.ai', color: 'qwen' },
    { name: 'Kimi', url: 'https://kimi.moonshot.cn', color: 'kimi' },
    { name: 'Perplexity', url: 'https://www.perplexity.ai', color: 'perplexity' },
    { name: 'Google', url: 'https://www.google.com', color: 'google' },
    { name: 'Wikipedia', url: 'https://www.wikipedia.org', color: 'wiki' },
  ];

  return (
    <>
      <div className="mobile-topbar">
        {/* Left: Brand */}
        <div className="mobile-brand" onClick={() => setShowHowTo(true)}>
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
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
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
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </button>

          {/* Auth */}
          {user ? (
            <div onClick={() => setShowProfile(true)} style={{ cursor: 'pointer' }}>
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

      {/* ===== MODELS SLIDE-IN (from right) ===== */}
      {showModels && (
        <>
          <div className="mobile-drawer-overlay" onClick={() => setShowModels(false)} />
          <div className="mobile-drawer-right">
            <div className="mobile-drawer-header">
              <span>AI Models & Sources</span>
              <button className="mobile-drawer-close" onClick={() => setShowModels(false)}>✕</button>
            </div>
            <div className="mobile-drawer-content">
              {/* ✅ FIX: Added missing opening <a> tag + moved key to correct position */}
              {allTools.map((tool, i) => (
                <a
                  key={i}
                  href={tool.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`drawer-item tool-${tool.color}`}
                  onClick={() => setShowModels(false)}
                >
                  {tool.name}
                </a>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ===== HOW TO MODAL ===== */}
      {showHowTo && (
        <div className="modal-overlay" onClick={() => setShowHowTo(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="close-modal-btn" onClick={() => setShowHowTo(false)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <h3>Master Your Workspace</h3>
            <p className="modal-intro">Your central command for interacting with AI.</p>
            <div className="instructions-grid">
              <div className="instruction-step">
                <div className="step-number">1</div>
                <div>
                  <h4>Select Your Mode</h4>
                  <p>Click the <strong>+</strong> icon to change how the AI behaves.</p>
                </div>
              </div>
              <div className="instruction-step">
                <div className="step-number">2</div>
                <div>
                  <h4>Type or Speak</h4>
                  <p>Type your prompt or click the <strong>Mic</strong> icon. Say <em>"send it"</em> to auto-send!</p>
                </div>
              </div>
              <div className="instruction-step">
                <div className="step-number">3</div>
                <div>
                  <h4>Generate & Listen</h4>
                  <p>Hit send to process. Select <strong>Generate Audio (TTS)</strong> to hear it!</p>
                </div>
              </div>
            </div>
            <button className="modal-action-btn" onClick={() => setShowHowTo(false)}>
              Got it, let's go!
            </button>
          </div>
        </div>
      )}

      {/* Profile Panel */}
      {showProfile && (
        <>
          <div className="profile-overlay" onClick={() => setShowProfile(false)} />
          <div className="profile-panel-wrapper">
            <ProfilePanel onClose={() => setShowProfile(false)} />
          </div>
        </>
      )}

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}
    </>
  );
};

export default MobileTopbar;