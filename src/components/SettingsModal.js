import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import ProfilePanel from './ProfilePanel';
import { supabase } from '../lib/supabase';

const SOCIALS = [
  {
    name: 'Facebook',
    url: 'https://www.facebook.com/share/1CaNwoLzQh/',
    color: '#1877F2',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    )
  },
  {
    name: 'X (Twitter)',
    url: 'https://x.com/vAIbeshub',
    color: '#000000',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    )
  },
  {
    name: 'YouTube',
    url: 'https://youtube.com/@v-ai-bes',
    color: '#FF0000',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    )
  },
  {
    name: 'GitHub',
    url: 'https://github.com/noctirionvale',
    color: '#333333',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
      </svg>
    )
  },
]

const SettingsModal = ({ onClose }) => {
  const { signOut, user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [userTier, setUserTier] = useState('free');
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    const fetchTier = async () => {
      if (!user?.id) return;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('plan')
          .eq('id', user.id)
          .maybeSingle();
        if (error) throw error;
        if (data?.plan) setUserTier(data.plan);
      } catch (err) {
        console.error('Error fetching user tier:', err);
        setUserTier('free');
      }
    };
    fetchTier();
  }, [user?.id]);

  const handleSignOut = () => {
    signOut();
    onClose();
  };

  const handleUpgrade = async () => {
    if (!user) return;
    setUpgrading(true);
    try {
      const response = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await response.json();
      if (data.url) {
        window.open(data.url, '_blank');
      } else {
        alert('Could not create payment link. Please try again.');
      }
    } catch (error) {
      console.error('Payment error:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="settings-modal" onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="settings-modal-header">
            <h3>Settings</h3>
            <button className="close-modal-btn" onClick={onClose}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          {/* Tab Nav */}
          <div className="settings-tabs">
            <button className={`settings-tab ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              Profile
            </button>
            <button className={`settings-tab ${activeTab === 'billing' ? 'active' : ''}`} onClick={() => setActiveTab('billing')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                <line x1="1" y1="10" x2="23" y2="10"></line>
              </svg>
              Billing
            </button>
            <button className={`settings-tab ${activeTab === 'howto' ? 'active' : ''}`} onClick={() => setActiveTab('howto')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              How To
            </button>
            <button className={`settings-tab ${activeTab === 'socials' ? 'active' : ''}`} onClick={() => setActiveTab('socials')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
              </svg>
              Socials
            </button>
          </div>

          {/* Tab Content */}
          <div className="settings-tab-content">

            {activeTab === 'profile' && (
              <ProfilePanel onClose={onClose} embedded={true} />
            )}

            {activeTab === 'billing' && (
              <div className="billing-panel">
                <p className="billing-current">
                  Current Plan: <span className={`billing-badge ${userTier}`}>{userTier.toUpperCase()}</span>
                </p>
                <p className="billing-usage">
                  {userTier === 'pro' ? '✅ 100 requests' : '2 requests / day · Resets at midnight'}
                </p>
                <div className="billing-tiers">
                  <div className={`billing-tier ${userTier === 'free' ? 'current-tier' : ''}`}>
                    <div className="tier-header">
                      <span className="tier-name">Free</span>
                      <span className="tier-price">$0 <small>/month</small></span>
                    </div>
                    <ul className="tier-features">
                      <li>✅ 2 requests/day after</li>
                      <li>✅ Study Mode with music</li>
                      <li>✅ WaveNet voice</li>
                      <li>❌ Image Analysis (Google Vision)</li>
                      <li>❌ Unlimited requests</li>
                      <li>❌ Priority responses</li>
                    </ul>
                    {userTier === 'free' && <div className="tier-current-label">Your current plan</div>}
                  </div>
                  <div className={`billing-tier ${userTier === 'pro' ? 'current-tier' : ''}`}>
                    <div className="tier-badge-pro">BEST VALUE</div>
                    <div className="tier-header">
                      <span className="tier-name">Pro</span>
                      <span className="tier-price">$3.34 <small>/month</small></span>
                    </div>
                    <ul className="tier-features">
                      <li>✅ 50 requests per day</li>
                      <li>✅ All 5 AI modes</li>
                      <li>✅ Study Mode with music</li>
                      <li>✅ Image Analysis (COMING SOON)</li>
                      <li>✅ Neural2 voice (COMING SOON)</li>
                      <li>✅ Priority responses</li>
                      <li>✅ Early access to new features</li>
                    </ul>
                    {userTier !== 'pro' && (
                      <div className="upgrade-options">
                        <button className="upgrade-btn" onClick={handleUpgrade} disabled={upgrading}>
                          {upgrading ? '⏳ Creating payment...' : '💳 Pay via Checkout'}
                        </button>
                        <div className="upgrade-divider"><span>or</span></div>
                        <div className="gcash-qr-section">
                          <p className="gcash-qr-label">
                            <span style={{ background: 'linear-gradient(135deg, #007DFF, #00C2FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', fontWeight: '800', fontSize: '1rem', marginRight: '0.3rem' }}>GCash</span>
                            Scan to pay ₱199
                          </p>
                          <div className="gcash-qr-wrapper">
                            <img src="/gcash-qr.png" alt="GCash QR Code" className="gcash-qr-img" />
                          </div>
                          <p className="gcash-qr-hint">
                            After payment, send screenshot to<br/>
                            <strong>noctirionvale@gmail.com</strong><br/>
                            with subject: <em>vAIbes Pro - [your email]</em>
                          </p>
                        </div>
                      </div>
                    )}
                    {userTier === 'pro' && (
                      <div className="tier-current-label" style={{ color: 'var(--accent2)' }}>
                        ✅ You are on Pro — 100 requests per day!
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'howto' && (
              <div className="howto-panel">
                <div className="instructions-grid">
                  {[
                    { n: 1, title: 'Select Your Mode', text: 'Click the + icon to switch between Explain, Summarize, Describe, Analyze, Generate Description, and Audio.' },
                    { n: 2, title: 'Type or Speak', text: 'Type your prompt or click the Mic icon. Say "send it" to auto-send hands-free!' },
                    { n: 3, title: 'Summarize YouTube Videos', text: 'Paste a YouTube link → click Get Transcript → copy from YouTube → paste back → hit Send. Works best on desktop!' },
                    { n: 4, title: 'Generate & Listen', text: 'Select Generate Audio (TTS) to have vAIbes speak the response out loud!' },
                    { n: 5, title: 'Free Daily Limit', text: 'Free accounts get 10 requests per day. Resets every midnight. Upgrade to Pro for unlimited!' },
                    { n: 6, title: 'AI Models & Sources', text: 'Use the right sidebar (or Models button on mobile) to visit ChatGPT, Gemini, and more!' },
                  ].map(step => (
                    <div className="instruction-step" key={step.n}>
                      <div className="step-number">{step.n}</div>
                      <div><h4>{step.title}</h4><p>{step.text}</p></div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ✅ FIXED SOCIALS TAB */}
            {activeTab === 'socials' && (
              <div className="socials-panel">
                <div className="socials-header">
                  <h4>Follow NoctirionVale</h4>
                  <p>Stay updated with the latest from vAIbes and our other projects.</p>
                </div>
                <div className="socials-grid">
                  {SOCIALS.map(social => (
                    <a
                      key={social.name}
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="social-card"
                      style={{ '--social-color': social.color }}
                    >
                      <div className="social-card-icon" style={{ color: social.color }}>
                        {social.icon}
                      </div>
                      <div className="social-card-info">
                        <div className="social-card-name">{social.name}</div>
                        <div className="social-card-handle">
                          {social.name === 'Facebook' && 'NoctirionVale'}
                          {social.name === 'X (Twitter)' && '@vAIbeshub'}
                          {social.name === 'YouTube' && '@v-ai-bes'}
                          {social.name === 'GitHub' && 'noctirionvale'}
                        </div>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="social-card-arrow">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                      </svg>
                    </a>
                  ))}
                </div>
                <div className="socials-footer">
                  <p>Built with ❤️ by <strong>NoctirionVale</strong></p>
                  <p style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '0.25rem' }}>
                    vAIbes · Knovia · Tindahan.AI
                  </p>
                </div>
              </div>
            )}

          </div>

          {/* Sign Out */}
          <div className="settings-footer">
            <button className="sign-out-btn settings-signout" onClick={handleSignOut}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              Sign Out
            </button>
          </div>

        </div>
      </div>
    </>
  );
};

export default SettingsModal;