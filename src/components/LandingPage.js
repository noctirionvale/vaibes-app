import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthModal from './AuthModal';

const LandingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const videoRef = useRef(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);

  // Auto-redirect logged in users
  useEffect(() => {
    if (user) {
      navigate('/app');
    }
  }, [user, navigate]);

  useEffect(() => {
  // Force dark mode on landing page
  document.body.classList.remove('light-mode');
}, []);

  // Auto-play video
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, []);

  const handleGetStarted = () => {
    setShowAuthModal(true);
  };

  const handleTryApp = () => {
    navigate('/app');
  };

  return (
    <div className="landing-page">

      {/* ===== BACKGROUND — Massive Logo ===== */}
      <div className="landing-bg-logo">
        <img src="hero.ai.png" alt="" className="landing-bg-img" />
      </div>

      {/* ===== NAVBAR ===== */}
      <nav className="landing-nav">
        <div className="landing-nav-brand">
          <img src="hero.ai.png" alt="vAIbes" className="landing-nav-logo" />
          <span className="landing-nav-name">vAIbes</span>
        </div>
        <div className="landing-nav-actions">
          <button className="landing-nav-signin" onClick={handleGetStarted}>
            Sign In
          </button>
          <button className="landing-nav-cta" onClick={handleGetStarted}>
            Get Started Free
          </button>
        </div>
      </nav>

      {/* ===== HERO SECTION ===== */}
      <section className="landing-hero">
        <div className="landing-hero-content">
          <div className="landing-badge">✦ AI Made Human</div>
          
          <h1 className="landing-headline">
            Demystify AI<br />
            <span className="landing-headline-accent">Through Action,</span><br />
            <span className="landing-headline-muted">Not Hype.</span>
          </h1>

          <p className="landing-desc">
            vAIbes is your warm, caring AI guide — built to make artificial intelligence 
            make sense to real people. Explain, summarize, analyze, generate. 
            No jargon. No corporate speak. Just clarity.
          </p>

          <div className="landing-cta-group">
            <button className="landing-cta-primary" onClick={handleGetStarted}>
              Start for Free
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
            <button className="landing-cta-secondary" onClick={handleTryApp}>
              Try Without Account
            </button>
          </div>

          <p className="landing-social-proof">
            Free • No credit card required • 10 requests/day
          </p>
        </div>

        {/* ===== VIDEO DEMO ===== */}
        <div className="landing-video-wrapper">
          <div className="landing-video-glow" />
          <div className="landing-video-frame">
            <div className="landing-video-bar">
              <span className="landing-video-dot red" />
              <span className="landing-video-dot yellow" />
              <span className="landing-video-dot green" />
              <span className="landing-video-title">vAIbes — AI Tools</span>
            </div>
            <video
              ref={videoRef}
              className="landing-video"
              autoPlay
              muted
              loop
              playsInline
              onLoadedData={() => setVideoLoaded(true)}
            >
              <source src="/demo.mp4" type="video/mp4" />
            </video>
            {!videoLoaded && (
              <div className="landing-video-placeholder">
                <div className="landing-video-placeholder-inner">
                  <img src="hero.ai.png" alt="vAIbes" style={{ width: '80px', opacity: 0.5 }} />
                  <p>Loading demo...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ===== FEATURES SECTION ===== */}
      <section className="landing-features">
        <div className="landing-features-inner">
          <h2 className="landing-section-title">
            Six Tools. One <span className="landing-accent">vAIbes</span>.
          </h2>
          <p className="landing-section-desc">
            Everything you need to interact with AI — without the overwhelm.
          </p>

          <div className="landing-features-grid">
            <div className="landing-feature-card">
              <div className="landing-feature-icon">💡</div>
              <h3>Explain Concept</h3>
              <p>Get any concept broken down simply — like a trusted friend explaining it over coffee.</p>
            </div>
            <div className="landing-feature-card">
              <div className="landing-feature-icon">📄</div>
              <h3>Summarize Text/Video</h3>
              <p>Paste any article or YouTube transcript and get the key points in seconds.</p>
            </div>
            <div className="landing-feature-card">
              <div className="landing-feature-icon">🔍</div>
              <h3>Describe Concept</h3>
              <p>Get vivid, structured descriptions of anything — ideas, products, scenarios.</p>
            </div>
            <div className="landing-feature-card">
              <div className="landing-feature-icon">📊</div>
              <h3>Analyze Data</h3>
              <p>Drop in text, numbers, or arguments and get sharp, honest insights back.</p>
            </div>
            <div className="landing-feature-card">
              <div className="landing-feature-icon">✍️</div>
              <h3>Generate Description</h3>
              <p>Professional, human-sounding copy for any product, service, or idea.</p>
            </div>
            <div className="landing-feature-card">
              <div className="landing-feature-icon">🔊</div>
              <h3>Generate Audio (TTS)</h3>
              <p>Have vAIbes speak the response out loud in a natural, warm voice.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== PRICING TEASER ===== */}
      <section className="landing-pricing">
        <div className="landing-pricing-inner">
          <h2 className="landing-section-title">Simple, Honest Pricing</h2>
          <p className="landing-section-desc">No tricks. No hidden fees. Just value.</p>

          <div className="landing-pricing-cards">
            <div className="landing-pricing-card">
              <h3>Free</h3>
              <div className="landing-price">$0 <span>/month</span></div>
              <ul>
                <li>✅ 5 requests on day 1</li>
                <li>✅ 2 requests/day reset</li>
                <li>✅ Study Mode with music</li>
                <li>✅ WaveNet voice</li>
              </ul>
              <button className="landing-cta-primary" onClick={handleGetStarted}>
                Start Free
              </button>
            </div>

            <div className="landing-pricing-card pro">
              <div className="landing-pro-badge">BEST VALUE</div>
              <h3>Pro</h3>
              <div className="landing-price">$3.34 <span>/month</span></div>
              <ul>
                <li>✅ 100 requests per day (resets at midnight)</li>
                <li>✅ All 7 AI modes</li>
                <li>✅ Study Mode with music</li>
                <li>✅ Image Analysis</li>
                <li>✅ Neural2 premium voice</li>
                <li>✅ Priority responses</li>
                <li>✅ Early access to features</li>
              </ul>
              <button className="landing-cta-primary" onClick={handleGetStarted}>
                Upgrade to Pro
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="landing-footer">
        <div className="landing-footer-brand">
          <img src="hero.ai.png" alt="vAIbes" style={{ width: '32px', borderRadius: '50%' }} />
          <span>vAIbes</span>
        </div>
        <p className="landing-footer-tagline">Demystify AI Through Action, Not Hype.</p>
        <p className="landing-footer-copy">© 2026 vAIbes. Built by NoctirionVale.</p>
      </footer>

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}

    </div>
  );
};

export default LandingPage;