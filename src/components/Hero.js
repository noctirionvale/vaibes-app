import React, { useState } from 'react';

const Hero = () => {
  // State to control our instructions modal
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <section className="hero">
        <div className="hero-inner">
          
          <div className="hero-visual">
            {/* If you want vAIbes literally hovering over the image, we can move the site-title div here, 
                but keeping it at the top of the text column usually looks best on desktop! */}
            <img src="hero.ai.png" alt="AI Visual Representation" />
          </div>
          
          <div className="hero-content">
            <div className="site-title">vAIbes</div>
            <div className="main-headline">Demystify AI</div>
            <div className="sub-headline">
              <span className="sub-headline-line1">Through Action,</span>
              <span className="sub-headline-line2">Not Hype.</span>
            </div>
            <p className="hero-desc">
              Your logic-smart workspace. Generate audio, analyze text, and explore advanced AI capabilities with zero exaggeration.
            </p>
            
            {/* This button now triggers the pop-up modal instead of just scrolling */}
            <button 
              className="read-more-btn" 
              onClick={() => setIsModalOpen(true)}
            >
              How To Use AI Powered Tools
            </button>
          </div>
          
        </div>
      </section>

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
            <p className="modal-intro">Your central command for interacting with DeepSeek AI.</p>
            
            <div className="instructions-grid">
              <div className="instruction-step">
                <div className="step-number">1</div>
                <div>
                  <h4>Select Your Mode</h4>
                  <p>Click the <strong>+</strong> icon to change how the AI behaves. You can ask it to explain, summarize, analyze, or even write scripts.</p>
                </div>
              </div>
              
              <div className="instruction-step">
                <div className="step-number">2</div>
                <div>
                  <h4>Provide Context</h4>
                  <p>Paste a long article, type a confusing concept, or ask a direct question into the command bar.</p>
                </div>
              </div>
              
              <div className="instruction-step">
                <div className="step-number">3</div>
                <div>
                  <h4>Generate & Listen</h4>
                  <p>Hit send to process your request. <em>Pro tip:</em> Select <strong>Generate Audio (TTS)</strong> to have the AI speak its answer out loud to you!</p>
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

export default Hero;