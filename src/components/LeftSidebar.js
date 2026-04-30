import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AuthModal from './AuthModal';
import SettingsModal from './SettingsModal';
import StudyMode from './StudyMode';

const LeftSidebar = ({ onOpenDM }) => {
  const { user, profile } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url;
  const displayName = profile?.display_name
    || user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || user?.email?.split('@')[0];

  return (
    <>
      <aside className="brand-sidebar">

        {/* ── TOP ZONE — Profile / Sign In ── */}
        <div className="sidebar-top-zone">
          {user ? (
            <div
              className="sidebar-user-card"
              onClick={() => setIsSettingsOpen(true)}
              title="Open Settings"
            >
              {avatarUrl
                ? <img src={avatarUrl} alt="avatar" className="user-avatar" />
                : <div className="user-avatar-placeholder">
                    {displayName?.charAt(0).toUpperCase()}
                  </div>
              }
              <div className="sidebar-user-info">
                <span className="user-display-name">{displayName}</span>
                <span className="sidebar-settings-hint">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"></path>
                  </svg>
                  Settings & Billing
                </span>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--muted)', flexShrink: 0 }}>
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </div>
          ) : (
            <button
              className="login-btn sidebar-login-btn"
              onClick={() => setIsAuthModalOpen(true)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              <span>Sign In</span>
            </button>
          )}
        </div>

        {/* ── MESSAGES ZONE — between profile and study mode ── */}
        {user && (
  <div className="sidebar-messages-zone" style={{ marginBottom: '0.5rem' }}>
    <button
      onClick={onOpenDM}
      className="sidebar-messages-btn"
      title="Messages"
    >
      <div className="sidebar-messages-icon">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </div>
      <div className="sidebar-messages-label">
        <span className="sidebar-messages-title">Messages</span>
        <span className="sidebar-messages-subtitle">Chat with users</span>
      </div>
    </button>
  </div>
)}

        {/* ── STUDY MODE ── */}
        <div className="sidebar-study-zone">
          <StudyMode />
        </div>

        {/* ── BOTTOM ZONE — Logo + Tagline ── */}
<div className="sidebar-bottom-zone">
  <div className="sidebar-middle-zone">
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* Glow ring behind logo */}
      <div style={{
        position: 'absolute',
        inset: '-6px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--accent1), var(--accent2), var(--accent3))',
        opacity: 0.4,
        filter: 'blur(10px)',
        animation: 'borderGlow 4s ease-in-out infinite alternate',
        zIndex: 0,
      }} />
      <img
        src="hero.ai.png"
        alt="vAIbes Logo"
        style={{
          position: 'relative',
          zIndex: 1,
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          objectFit: 'cover',
          border: '2px solid rgba(106,92,255,0.5)',
          boxShadow: '0 8px 24px rgba(106,92,255,0.3)',
          display: 'block',
          animation: 'gentleFloat 10s ease-in-out infinite',
        }}
      />
    </div>
    <div className="brand-text-wrapper" style={{ textAlign: 'center' }}>
      <div style={{
        fontSize: '1.3rem',
        fontWeight: 800,
        letterSpacing: '-0.5px',
        background: 'linear-gradient(135deg, var(--accent1), var(--accent2))',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}>
        vAIbes
      </div>
      <div style={{
        fontSize: '0.72rem',
        color: 'var(--muted)',
        lineHeight: 1.4,
        marginTop: '2px',
        opacity: 0.8,
      }}>
        Demystify AI
      </div>
      <div style={{
        fontSize: '0.68rem',
        color: 'var(--muted)',
        opacity: 0.5,
        lineHeight: 1.3,
      }}>
        Through Action, Not Hype.
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