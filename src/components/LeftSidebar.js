import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AuthModal from './AuthModal';

const LeftSidebar = () => {
  const { user, signOut } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const avatarUrl = user?.user_metadata?.avatar_url;
  const displayName = user?.user_metadata?.full_name 
    || user?.user_metadata?.name 
    || user?.email?.split('@')[0];

  return (
    <>
      <aside className="brand-sidebar">

        {/* TOP ZONE: Auth / Profile */}
        <div className="sidebar-top-zone">
          {user ? (
            <div className="user-profile-btn">
              {avatarUrl 
                ? <img src={avatarUrl} alt="avatar" className="user-avatar" />
                : <div className="user-avatar-placeholder">
                    {displayName?.charAt(0).toUpperCase()}
                  </div>
              }
              <span className="user-display-name">{displayName}</span>
              <button className="sign-out-btn" onClick={signOut}>Sign Out</button>
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

        {/* MIDDLE ZONE */}
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

        {/* BOTTOM ZONE */}
        <div className="sidebar-bottom-zone">
          <button className="read-more-btn sidebar-how-to-btn" onClick={() => setIsModalOpen(true)}>
            How To Use vAIbes Tools
          </button>
        </div>

      </aside>

      {/* How To Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="close-modal-btn" onClick={() => setIsModalOpen(false)}>
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
                  <p>Type your prompt, or click the <strong>Mic</strong> icon. Say <em>"send it"</em> to auto-send!</p>
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
            <button className="modal-action-btn" onClick={() => setIsModalOpen(false)}>
              Got it, let's go!
            </button>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      {isAuthModalOpen && (
        <AuthModal onClose={() => setIsAuthModalOpen(false)} />
      )}
    </>
  );
};

export default LeftSidebar;