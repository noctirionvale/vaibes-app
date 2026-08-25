import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthModal from './AuthModal';
import TypingCat from './TypingCat';
import './LandingPage.css';

const QUIPS = [
  "let me explain that... 💡",
  "study mode: activated 🎧",
  "i annotate, therefore i am",
  "your AI bestie is here!",
  "coffee? i run on context ☕",
  "drop your notes. i got you.",
  "no cap, AI is actually fun",
  "less cringe, more vibe ✨",
  "summarize? already done 😎",
  "i don't sleep. i learn.",
  "peek-a-boo, i see your notes 👀",
  "shhh... i'm computing 🤫",
];

const CAT_MODES = ['explain', 'summarize', 'analyze', 'writeDraft', 'quizMe'];

const FEATURES = [
  { emoji: '🤖', label: 'AI Chat',      desc: '5 modes, real memory — builds on context instead of guessing cold' },
  { emoji: '✏️', label: 'UserWall',     desc: 'Notes, essays, recipes — or a photo & video gallery, all yours' },
  { emoji: '💬', label: 'Study Rooms',  desc: 'Every post gets a live room — friends can drop in and discuss it' },
  { emoji: '📚', label: 'EduFeed',      desc: 'Turn any note into a quiz — a card feed built for learning, not scrolling' },
  { emoji: '📺', label: 'VidFeed',      desc: 'No algorithm — pick your channels, that\'s your whole feed' },
  { emoji: '🎧', label: 'StudyWidget',  desc: 'Lo-fi, jazz, or nature sounds, plus a clock and focus timer' },
];

const LandingPage = () => {
  const navigate      = useNavigate();
  const { user }      = useAuth();
  const videoRef      = useRef(null);
  const [showAuth,    setShowAuth]    = useState(false);
  const [quipIdx,     setQuipIdx]     = useState(0);
  const [quipVisible, setQuipVisible] = useState(true);
  const [catMode,     setCatMode]     = useState('explain');
  const [revealed,    setRevealed]    = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [peekY,       setPeekY]       = useState(0);

  useEffect(() => { if (user) navigate('/app'); }, [user, navigate]);
  useEffect(() => { document.body.classList.remove('light-mode'); }, []);
  useEffect(() => { const t = setTimeout(() => setRevealed(true), 80); return () => clearTimeout(t); }, []);
  useEffect(() => { videoRef.current?.play().catch(() => {}); }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setQuipVisible(false);
      setTimeout(() => { setQuipIdx(i => (i + 1) % QUIPS.length); setQuipVisible(true); }, 320);
    }, 3400);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setCatMode(CAT_MODES[Math.floor(Math.random() * CAT_MODES.length)]);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let timeout;
    const moves = [
      () => { setPeekY(-60); setTimeout(() => setPeekY(0), 600); },
      () => { setPeekY(-120); setTimeout(() => setPeekY(20), 400); setTimeout(() => setPeekY(0), 700); },
      () => { setPeekY(-30); setTimeout(() => setPeekY(0), 350); },
      () => {
        setPeekY(-50);
        setTimeout(() => setPeekY(0), 300);
        setTimeout(() => setPeekY(-80), 600);
        setTimeout(() => setPeekY(0), 950);
      },
      () => { setPeekY(-90); setTimeout(() => setPeekY(0), 1200); },
      () => { setPeekY(-70); setTimeout(() => setPeekY(15), 500); setTimeout(() => setPeekY(0), 750); },
    ];
    const schedule = () => {
      const delay = 2000 + Math.random() * 3500;
      timeout = setTimeout(() => { moves[Math.floor(Math.random() * moves.length)](); schedule(); }, delay);
    };
    schedule();
    return () => clearTimeout(timeout);
  }, []);

  return (
    <>
      <div className={`lp-root ${revealed ? 'lp-revealed' : ''}`}>

        {/* ── NAV ── */}
        <nav className="lp-nav">
          <div className="lp-nav-brand">
            <img src="/hero.ai.png" alt="vAIbes" className="lp-nav-logo" />
            <span className="lp-nav-name">vAIbes</span>
          </div>
          <div className="lp-nav-actions">
            <button className="lp-btn-ghost" onClick={() => setShowAuth(true)}>Sign In</button>
            <button className="lp-btn-primary" onClick={() => setShowAuth(true)}>Get Started — Free</button>
          </div>
        </nav>

        {/* ── MAIN GRID ── */}
        <main className="lp-main">

          {/* ── LEFT: Features ── */}
          <div className="lp-left">
            <div className="lp-features">
              {FEATURES.map((f) => (
                <div key={f.label} className="lp-feature-pill">
                  <span className="lp-feature-emoji">{f.emoji}</span>
                  <div className="lp-feature-text">
                    <span className="lp-feature-label">{f.label}</span>
                    <span className="lp-feature-desc">{f.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── CENTER: Hero + Video ── */}
          <div className="lp-center">
            <div className="lp-hero">
              <div className="lp-eyebrow">✦ AI · Study · Create · Connect</div>
              
              <h1 className="lp-headline">
                Your all-in-one<br />
                <span className="lp-accent">student workspace.</span>
              </h1>

              <p className="lp-body">
                vAIbes brings AI assistance, study music, creative tools,
                and real-time messaging into one tab — stop switching apps
                and start actually getting things done.
              </p>
            </div>

            <div className="lp-video-wrapper">
              <div className="lp-video-bar">
                <span className="lp-video-dot red" />
                <span className="lp-video-dot yellow" />
                <span className="lp-video-dot green" />
                <span className="lp-video-title">vAIbes — Live Demo</span>
              </div>
              <video
                ref={videoRef}
                className="lp-video"
                autoPlay muted loop playsInline
                onLoadedData={() => setVideoLoaded(true)}
              >
                <source src="/demo.mp4" type="video/mp4" />
              </video>
              {!videoLoaded && (
                <div className="lp-video-placeholder">
                  <img src="/hero.ai.png" alt="vAIbes" />
                  <p>Loading demo...</p>
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: Unified Vaibey Hero ── */}
<div className="lp-right">
  <div className="lp-vaibey-hero">
    {/* Main headline */}
    <div className="lp-vaibey-headline">
      Learn smarter.<br />
      Create freely.<br />
      Connect instantly.
    </div>

    {/* Vaibey intro with cat integrated */}
    <div className="lp-vaibey-intro">
      <span className="lp-vaibey-hi">👋 Meet Vaibey</span>
      <p>Your pixel-art AI mascot. She types, reacts, and keeps you company while you study.</p>
      
      {/* Cat positioned as part of the intro */}
      <div className="lp-vaibey-cat-wrap">
  {/* Bubble FIRST (appears above cat) */}
  <div className={`lp-bubble ${quipVisible ? 'lp-bubble-in' : 'lp-bubble-out'}`}>
    <span className="lp-bubble-name">VAIBEY says</span>
    <span className="lp-bubble-text">{QUIPS[quipIdx]}</span>
  </div>

  {/* Cat SECOND (appears below bubble) */}
  <div
    className="lp-vaibey-peek"
    style={{ transform: `translateY(${peekY}px)` }}
  >
    <TypingCat
      mode={catMode}
      isDark={true}
      size={7}
      showBadge={false}
      autoPlay={true}
    />
  </div>
</div>
    </div>

    <div className="lp-vaibey-glow" />
  </div>
</div>
        </main>

        {/* ── FOOTER ── */}
        <footer className="lp-footer">
          <span className="lp-footer-copy">© 2026 vAIbes · Built by NoctirionVale</span>
        </footer>
      </div>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  );
};

export default LandingPage;