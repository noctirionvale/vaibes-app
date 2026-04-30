import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AuthModal from './AuthModal';
import SettingsModal from './SettingsModal';
import StudyMode from './StudyMode';

const LeftSidebar = ({ onOpenDM }) => {
  const { user, profile } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [profileHover, setProfileHover] = useState(false);
  const [dmHover, setDmHover] = useState(false);

  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url;
  const displayName = profile?.display_name
    || user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || user?.email?.split('@')[0];

  const isPro = profile?.plan === 'pro' || profile?.is_dev;

  return (
    <>
      <aside className="brand-sidebar">

        {/* ── TOP ZONE ── */}
        <div className="sidebar-top-zone">
          {user ? (
            <div
              onClick={() => setIsSettingsOpen(true)}
              onMouseEnter={() => setProfileHover(true)}
              onMouseLeave={() => setProfileHover(false)}
              title="Open Settings"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                borderRadius: '14px',
                background: profileHover
                  ? 'rgba(106,92,255,0.12)'
                  : 'rgba(255,255,255,0.04)',
                border: `1px solid ${profileHover
                  ? 'rgba(106,92,255,0.35)'
                  : 'rgba(255,255,255,0.07)'}`,
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                boxShadow: profileHover
                  ? '0 4px 20px rgba(106,92,255,0.15)'
                  : 'none',
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              {/* Avatar */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="avatar"
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '2px solid rgba(106,92,255,0.4)',
                      display: 'block',
                    }}
                  />
                ) : (
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6a5cff, #00e5ff)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '1rem',
                    color: 'white',
                    border: '2px solid rgba(106,92,255,0.4)',
                    flexShrink: 0,
                  }}>
                    {displayName?.charAt(0).toUpperCase()}
                  </div>
                )}
                {/* Online dot */}
                <div style={{
                  position: 'absolute',
                  bottom: '1px',
                  right: '1px',
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: '#22c55e',
                  border: '2px solid var(--bg, #050505)',
                }} />
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  marginBottom: '2px',
                }}>
                  <span style={{
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    color: 'var(--text)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '110px',
                  }}>
                    {displayName}
                  </span>
                  {isPro && (
                    <span style={{
                      fontSize: '0.58rem',
                      fontWeight: 800,
                      background: 'linear-gradient(135deg, #6a5cff, #00e5ff)',
                      color: 'white',
                      padding: '1px 5px',
                      borderRadius: '4px',
                      letterSpacing: '0.04em',
                      flexShrink: 0,
                    }}>
                      PRO
                    </span>
                  )}
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  fontSize: '0.7rem',
                  color: 'var(--muted)',
                }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                  </svg>
                  Settings & Billing
                </div>
              </div>

              {/* Arrow */}
              <svg
                width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2"
                style={{
                  color: profileHover ? 'var(--accent1)' : 'var(--muted)',
                  flexShrink: 0,
                  transition: 'color 0.2s ease',
                }}
              >
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          ) : (
            <button
              className="login-btn sidebar-login-btn"
              onClick={() => setIsAuthModalOpen(true)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <span>Sign In</span>
            </button>
          )}
        </div>

        {/* ── MESSAGES ── */}
        {user && (
          <div style={{ padding: '0 0 0.5rem 0' }}>
            <button
              onClick={onOpenDM}
              onMouseEnter={() => setDmHover(true)}
              onMouseLeave={() => setDmHover(false)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.65rem 0.75rem',
                background: dmHover
                  ? 'rgba(0,229,255,0.08)'
                  : 'rgba(0,229,255,0.03)',
                border: `1px solid ${dmHover
                  ? 'rgba(0,229,255,0.3)'
                  : 'rgba(0,229,255,0.1)'}`,
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                color: 'inherit',
                fontFamily: 'Inter, sans-serif',
                textAlign: 'left',
                boxSizing: 'border-box',
                boxShadow: dmHover
                  ? '0 4px 16px rgba(0,229,255,0.08)'
                  : 'none',
              }}
            >
              {/* Icon */}
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: dmHover
                  ? 'rgba(0,229,255,0.15)'
                  : 'rgba(0,229,255,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'background 0.25s ease',
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2"
                  style={{ color: '#00e5ff' }}>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>

              {/* Label */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: dmHover ? '#00e5ff' : 'var(--text)',
                  transition: 'color 0.2s ease',
                  lineHeight: 1.3,
                }}>
                  Messages
                </div>
                <div style={{
                  fontSize: '0.68rem',
                  color: 'var(--muted)',
                  marginTop: '1px',
                }}>
                  Chat with users
                </div>
              </div>

              {/* Arrow */}
              <svg
                width="13" height="13" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2"
                style={{
                  color: dmHover ? '#00e5ff' : 'var(--muted)',
                  flexShrink: 0,
                  transition: 'all 0.2s ease',
                  transform: dmHover ? 'translateX(2px)' : 'translateX(0)',
                }}
              >
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>
        )}

        {/* ── STUDY MODE ── */}
        <div className="sidebar-study-zone">
          <StudyMode />
        </div>

        {/* ── BOTTOM ZONE ── */}
        <div className="sidebar-bottom-zone">
          <div className="sidebar-middle-zone">
            <div className="brand-visual">
              <img src="hero.ai.png" alt="vAIbes Logo" className="sidebar-logo" />
            </div>
            <div className="brand-text-wrapper">
              <div className="site-title sidebar-title">vAIbes</div>
              <div className="main-headline sidebar-headline">Demystify AI</div>
              <div className="sub-headline sidebar-sub">
                <span className="sub-headline-line1">Through Action,</span>
                <span className="sub-headline-line2">Not Hype.</span>
              </div>
            </div>
          </div>
        </div>

      </aside>

      {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
      {isAuthModalOpen && <AuthModal onClose={() => setIsAuthModalOpen(false)} />}
    </>
  );
};

export default LeftSidebar;