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

  useEffect(() => {
    if (user) navigate('/app');
  }, [user, navigate]);

  useEffect(() => {
    document.body.classList.remove('light-mode');
  }, []);

  useEffect(() => {
    videoRef.current?.play().catch(() => {});
  }, []);

  const handleGetStarted = () => setShowAuthModal(true);
  const handleTryApp = () => navigate('/app');

  return (
    <div className="landing-page">
      <div className="landing-bg-logo">
        <img src="hero.ai.png" alt="" className="landing-bg-img" />
      </div>

      <nav className="landing-nav">
        <div className="landing-nav-brand">
          <img src="hero.ai.png" alt="vAIbes" className="landing-nav-logo" />
          <span className="landing-nav-name">vAIbes</span>
        </div>
        <div className="landing-nav-actions">
          <button className="landing-nav-signin" onClick={handleGetStarted}>Sign In</button>
          <button className="landing-nav-cta" onClick={handleGetStarted}>Get Started Free</button>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-content">
          <div className="landing-badge">✦ AI + Focus + Media</div>
          <h1 className="landing-headline">
            Your AI‑Powered<br />
            <span className="landing-headline-accent">Study & Chill Space</span>
          </h1>
          <p className="landing-desc">
            vAIbes combines a warm AI guide with live cams, wallpapers, study music,
            and direct messages — all in one beautifully designed interface.
            No more switching between tabs.
          </p>
          <div className="landing-cta-group">
            <button className="landing-cta-primary" onClick={handleGetStarted}>
              Start for Free
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
            <button className="landing-cta-secondary" onClick={handleTryApp}>Try Without Account</button>
          </div>
          <p className="landing-social-proof">Free tier • No credit card • 0 AI requests/day • Unlimited media & DMs (Pro only)</p>
        </div>

        <div className="landing-video-wrapper">
          <div className="landing-video-glow" />
          <div className="landing-video-frame">
            <div className="landing-video-bar">
              <span className="landing-video-dot red" /><span className="landing-video-dot yellow" /><span className="landing-video-dot green" />
              <span className="landing-video-title">vAIbes — Live Cams & AI Chat</span>
            </div>
            <video ref={videoRef} className="landing-video" autoPlay muted loop playsInline onLoadedData={() => setVideoLoaded(true)}>
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

      <section className="landing-features">
        <div className="landing-features-inner">
          <h2 className="landing-section-title">Everything you need, <span className="landing-accent">all in one place</span>.</h2>
          <p className="landing-section-desc">Study, relax, create, and connect — powered by AI.</p>
          <div className="landing-features-grid">
            <div className="landing-feature-card"><div className="landing-feature-icon">🎧</div><h3>Study Mode</h3><p>Play lo‑fi, jazz, or deep focus music from YouTube while you work. No distractions.</p></div>
            <div className="landing-feature-card"><div className="landing-feature-icon">📹</div><h3>Live Cams & Wallpapers</h3><p>Embed zoo, aquarium, or city live cams. Download stunning wallpapers with one click.</p></div>
            <div className="landing-feature-card"><div className="landing-feature-icon">🤖</div><h3>AI Chat <span style={{ fontSize: '0.7rem', background: 'var(--accent1)', padding: '2px 6px', borderRadius: '20px', color: 'white', marginLeft: '6px' }}>Pro</span></h3><p>Ask anything — get clear, human‑sounding answers. Works with text, YouTube transcripts.</p></div>
            <div className="landing-feature-card"><div className="landing-feature-icon">💬</div><h3>User‑to‑User DMs <span style={{ fontSize: '0.7rem', background: 'var(--accent1)', padding: '2px 6px', borderRadius: '20px', color: 'white', marginLeft: '6px' }}>Pro</span></h3><p>Real‑time messaging with other vAIbes users. Perfect for study groups or communities.</p></div>
            <div className="landing-feature-card"><div className="landing-feature-icon">📥</div><h3>Download & Share</h3><p>One‑click download of wallpapers and video clips. Apple‑style design, zero friction.</p></div>
            <div className="landing-feature-card"><div className="landing-feature-icon">⭐</div><h3>Featured Highlights</h3><p>Admins (or users) can promote any card to the top — live cams, trailers, wallpapers, anything.</p></div>
          </div>
        </div>
      </section>

      <section className="landing-pricing">
        <div className="landing-pricing-inner">
          <h2 className="landing-section-title">Simple, Honest Pricing</h2>
          <p className="landing-section-desc">AI requests and DMs require Pro; all media features are free.</p>
          <div className="landing-pricing-cards">
            <div className="landing-pricing-card">
              <h3>Free</h3>
              <div className="landing-price">₱0 <span>/month</span></div>
              <ul>
                <li>❌ No AI chat</li>
                <li>❌ No direct messages</li>
                <li>✅ YouTube feed</li>
                <li>✅ Study Mode (music)</li>
                <li>✅ Live cams & wallpapers</li>
              </ul>
              <button className="landing-cta-primary" onClick={handleGetStarted}>Start Free</button>
            </div>
            <div className="landing-pricing-card pro">
              <div className="landing-pro-badge">BEST VALUE</div>
              <h3>Pro</h3>
              <div className="landing-price">₱199 <span>/month</span></div>
              <ul>
                <li>✅ 50 AI requests/day</li>
                <li>✅ All AI modes (Explain, Summarize, Analyze, Generate)</li>
                <li>✅ Direct messages</li>
                <li>✅ YouTube feed</li>
                <li>✅ All free features (unlimited media & study mode)</li>
                <li>✅ Early access to new AI tools</li>
              </ul>
              <button className="landing-cta-primary" onClick={handleGetStarted}>Upgrade to Pro</button>
            </div>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-brand"><img src="hero.ai.png" alt="vAIbes" style={{ width: '32px', borderRadius: '50%' }} /><span>vAIbes</span></div>
        <p className="landing-footer-tagline">Demystify AI Through Action, Not Hype.<br />Study. Chill. Connect. All in one tab.</p>
        <p className="landing-footer-copy">© 2026 vAIbes. Built by NoctirionVale.</p>
      </footer>

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </div>
  );
};

export default LandingPage;