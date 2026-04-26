import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import AuthModal from './AuthModal';
import SettingsModal from './SettingsModal';
import MobileStudyMode from './MobileStudyMode';
import DirectMessage from './DirectMessage';
import './MobileTopbar.css'; // adjust path to match your structure

const MobileTopbar = () => {
  const { user, profile } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showModels, setShowModels] = useState(false);
  const [showStudy, setShowStudy] = useState(false);
  const [showDM, setShowDM] = useState(false);

  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url;
  const displayName =
    profile?.display_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0];

  const allTools = [
    { name: 'Grok',       url: 'https://grok.com',                color: 'grok'        },
    { name: 'ChatGPT',    url: 'https://chat.openai.com',         color: 'chatgpt'     },
    { name: 'Gemini',     url: 'https://gemini.google.com',       color: 'gemini'      },
    { name: 'DeepSeek',   url: 'https://chat.deepseek.com',       color: 'deepseek'    },
    { name: 'Claude',     url: 'https://claude.ai',               color: 'claude'      },
    { name: 'Qwen',       url: 'https://chat.qwen.ai',            color: 'qwen'        },
    { name: 'Kimi',       url: 'https://kimi.moonshot.cn',        color: 'kimi'        },
    { name: 'Perplexity', url: 'https://www.perplexity.ai',       color: 'perplexity'  },
    { name: 'Google',     url: 'https://www.google.com',          color: 'google'      },
    { name: 'Wikipedia',  url: 'https://www.wikipedia.org',       color: 'wiki'        },
  ];

  return (
    <>
      {/* ═══════════ TOPBAR ═══════════ */}
      <div className="mobile-topbar">

        {/* Left: Avatar/Login + Brand name */}
        <div className="mobile-brand">
          {user ? (
            <div
              className="mobile-avatar-wrap"
              onClick={() => setShowSettings(true)}
              title="Profile & Settings"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className="mobile-avatar" />
              ) : (
                <div className="mobile-avatar-placeholder">
                  {displayName?.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          ) : (
            <button
              className="mobile-login-btn"
              onClick={() => setShowAuthModal(true)}
            >
              Sign In
            </button>
          )}
          <span className="mobile-brand-name">vAIbes</span>
        </div>

        {/* Right: Action icons */}
        <div className="mobile-topbar-right">

          {/* Study Mode */}
          <button
            className="mobile-icon-btn"
            onClick={() => setShowStudy(true)}
            title="Study Mode"
          >
            <span style={{ fontSize: '1.15rem', lineHeight: 1 }}>🎓</span>
          </button>

          {/* Theme toggle */}
          <button
            className="mobile-icon-btn"
            onClick={toggleTheme}
            title="Toggle theme"
          >
            {isDark ? (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>

          {/* Messages */}
          <button
            className="mobile-icon-btn"
            onClick={() => setShowDM(true)}
            title="Messages"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </button>

          {/* AI Models */}
          <button
            className="mobile-icon-btn"
            onClick={() => setShowModels(true)}
            title="AI Models"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </button>

        </div>
      </div>

      {/* ═══════════ DM MODAL ═══════════ */}
      {showDM && (
        <div
          className="mobile-modal-overlay"
          onClick={() => setShowDM(false)}
        >
          <div
            className="mobile-dm-sheet"
            onClick={e => e.stopPropagation()}
          >
            <DirectMessage onClose={() => setShowDM(false)} />
          </div>
        </div>
      )}

      {/* ═══════════ STUDY MODE DRAWER ═══════════ */}
      <MobileStudyMode isOpen={showStudy} onClose={() => setShowStudy(false)} />

      {/* ═══════════ AI MODELS DRAWER ═══════════ */}
      {showModels && (
        <>
          <div
            className="mobile-modal-overlay"
            onClick={() => setShowModels(false)}
          />
          <div className="mobile-bottom-sheet">
            <div className="mobile-sheet-handle" />
            <div className="mobile-sheet-header">
              <span>AI Models &amp; Sources</span>
              <button
                className="mobile-sheet-close"
                onClick={() => setShowModels(false)}
              >
                ✕
              </button>
            </div>
            <div className="mobile-sheet-body">
              {allTools.map((tool, i) => (
                <a
                  key={i}
                  href={tool.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`mobile-tool-item tool-${tool.color}`}
                >
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
          <div
            className="mobile-modal-overlay"
            onClick={() => setShowSettings(false)}
          />
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