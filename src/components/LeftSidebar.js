import React, { useState } from 'react';

const LeftSidebar = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <aside className="brand-sidebar">
        
        {/* TOP ZONE: Auth / Profile */}
        <div className="sidebar-top-zone">
          <button className="login-btn sidebar-login-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <span>Sign In</span>
          </button>
        </div>

        {/* MIDDLE ZONE: Brand & Taglines (Side-by-Side Layout) */}
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
        
        {/* BOTTOM ZONE: Action Button */}
        <div className="sidebar-bottom-zone">
          <button 
            className="read-more-btn sidebar-how-to-btn" 
            onClick={() => setIsModalOpen(true)}
          >
            How To Use vAIbes Tools
          </button>
        </div>

      </aside>

      {/* The Glassmorphism Instructions Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-modal-btn" onClick={() => setIsModalOpen(false)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                  <p>Click the <strong>+</strong> icon to change how the AI behaves (Summarize, Explain, etc).</p>
                </div>
              </div>
              
              <div className="instruction-step">
                <div className="step-number">2</div>
                <div>
                  {/* ✨ THE NEW VOICE INSTRUCTIONS ✨ */}
                  <h4>Type or Speak</h4>
                  <p>Type your prompt, or click the <strong>Mic</strong> icon to dictate. Say <em>"send it"</em> at the end of your sentence to auto-send hands-free!</p>
                </div>
              </div>
              
              <div className="instruction-step">
                <div className="step-number">3</div>
                <div>
                  <h4>Generate & Listen</h4>
                  <p>Hit send to process your request. Select <strong>Generate Audio (TTS)</strong> to have it spoken out loud to you!</p>
                </div>
              </div>
            </div>
            
            <button className="modal-action-btn" onClick={() => setIsModalOpen(false)}>
              Got it, let's go!
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default LeftSidebar;