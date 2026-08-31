import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AuthModal from './AuthModal';
import SettingsModal from './SettingsModal';
import StudyWidget from './StudyWidget';
import './Sidebar.css';

const LeftSidebar = () => {
  const { user, profile } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url;
  const displayName =
    profile?.display_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0];

  return (
    <>
      <aside className="brand-sidebar">
        {/* TOP ZONE — Profile / Sign In */}
        <div className="sidebar-top-zone">
          {user ? (
            <div
              className="sidebar-user-card sidebar-interactive"
              data-tour="sidebar-profile"
              role="button"
              tabIndex={0}
              aria-label="Open Settings"
              onClick={() => setIsSettingsOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setIsSettingsOpen(true);
                }
              }}
              title="Open Settings"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className="user-avatar" />
              ) : (
                <div className="user-avatar-placeholder">
                  {displayName?.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="sidebar-user-info">
                <span className="user-display-name">{displayName}</span>
                <span className="sidebar-settings-hint">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
                  </svg>
                  Settings
                </span>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="settings-gear-icon">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </div>
          ) : (
            <button
              className="login-btn sidebar-login-btn sidebar-interactive"
              onClick={() => setIsAuthModalOpen(true)}
              aria-label="Sign In"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span>Sign In</span>
            </button>
          )}
        </div>

        {/* STUDY ZONE — permanently docked, fills the space that used to be empty */}
        <div className="sidebar-study-zone" data-tour="study-widget">
          <StudyWidget />
        </div>

        {/* BOTTOM ZONE — Logo row */}
        <div className="sidebar-bottom-zone">
          <div className="sidebar-brand-row">
            <div className="logo-glow-wrapper">
              <div className="logo-glow-effect" />
              <img src="hero.ai.png" alt="vAIbes Logo" className="sidebar-logo" />
            </div>
            <div className="brand-text-wrapper">
              <div className="sidebar-brand-name">vAIbes</div>
              <div className="sidebar-tagline">Learn smarter. Create freely.</div>
              <div className="sidebar-tagline-secondary">Connect instantly.</div>
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