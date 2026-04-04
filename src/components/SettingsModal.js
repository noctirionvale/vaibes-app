import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import ProfilePanel from './ProfilePanel';
import { supabase } from '../lib/supabase';

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
          .single();
        
        if (error) throw error;
        if (data?.plan) setUserTier(data.plan);
      } catch (err) {
        console.error('Error fetching user tier:', err);
        setUserTier('free');
      }
    };
    fetchTier();
  }, [user]);

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
            <button
              className={`settings-tab ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              Profile
            </button>
            <button
              className={`settings-tab ${activeTab === 'billing' ? 'active' : ''}`}
              onClick={() => setActiveTab('billing')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                <line x1="1" y1="10" x2="23" y2="10"></line>
              </svg>
              Billing
            </button>
            <button
              className={`settings-tab ${activeTab === 'howto' ? 'active' : ''}`}
              onClick={() => setActiveTab('howto')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              How To
            </button>
          </div>

          {/* Tab Content */}
          <div className="settings-tab-content">

            {/* PROFILE TAB */}
            {activeTab === 'profile' && (
              <ProfilePanel onClose={onClose} embedded={true} />
            )}

            {/* BILLING TAB */}
            {activeTab === 'billing' && (
              <div className="billing-panel">
                <p className="billing-current">
                  Current Plan: <span className={`billing-badge ${userTier}`}>{userTier.toUpperCase()}</span>
                </p>
                <p className="billing-usage">
                  {userTier === 'pro' ? '✅ 100 requests' : '2 requests / day · Resets at midnight'}
                </p>

                <div className="billing-tiers">
                  {/* Free Tier */}
                  <div className={`billing-tier ${userTier === 'free' ? 'current-tier' : ''}`}>
                    <div className="tier-header">
                      <span className="tier-name">Free</span>
                      <span className="tier-price">$0 <small>/month</small></span>
                    </div>
                    <ul className="tier-features">
                      <li>✅ 5 requests on signup day</li>
                      <li>✅ 2 requests/day after</li>
                      <li>✅ Study Mode with music</li>
                      <li>✅ WaveNet voice</li>
                      <li>❌ Image Analysis (Google Vision)</li>
                      <li>❌ Unlimited requests</li>
                      <li>❌ Priority responses</li>
                    </ul>
                    {userTier === 'free' && (
                      <div className="tier-current-label">Your current plan</div>
                    )}
                  </div>

                  {/* Pro Tier */}
                  <div className={`billing-tier ${userTier === 'pro' ? 'current-tier' : ''}`}>
                    <div className="tier-badge-pro">BEST VALUE</div>
                    <div className="tier-header">
                      <span className="tier-name">Pro</span>
                      <span className="tier-price">$3.34 <small>/month</small></span>
                    </div>
                    <ul className="tier-features">
                      <li>✅ 100 requests per day (resets at midnight)</li>
                      <li>✅ All 7 AI modes</li>
                      <li>✅ Study Mode with music</li>
                      <li>✅ Image Analysis (Google Vision)</li>
                      <li>✅ Neural2 voice (premium quality)</li>
                      <li>✅ Priority responses</li>
                      <li>✅ Early access to new features</li>
                    </ul>
                    
                    {userTier !== 'pro' && (
                      <div className="upgrade-options">
                        <button
                          className="upgrade-btn"
                          onClick={handleUpgrade}
                          disabled={upgrading}
                        >
                          {upgrading ? '⏳ Creating payment...' : '💳 Pay via Checkout'}
                        </button>

                        <div className="upgrade-divider">
                          <span>or</span>
                        </div>

                        <div className="gcash-qr-section">
                          <p className="gcash-qr-label">
                            <span style={{
                              background: 'linear-gradient(135deg, #007DFF, #00C2FF)',
                              WebkitBackgroundClip: 'text',
                              WebkitTextFillColor: 'transparent',
                              backgroundClip: 'text',
                              fontWeight: '800',
                              fontSize: '1rem',
                              marginRight: '0.3rem'
                            }}>
                              GCash
                            </span>
                            Scan to pay ₱199
                          </p>
                          <div className="gcash-qr-wrapper">
                            <img
                              src="/gcash-qr.png"
                              alt="GCash QR Code"
                              className="gcash-qr-img"
                            />
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

            {/* HOW TO TAB */}
            {activeTab === 'howto' && (
              <div className="howto-panel">
                <div className="instructions-grid">
                  <div className="instruction-step">
                    <div className="step-number">1</div>
                    <div>
                      <h4>Select Your Mode</h4>
                      <p>Click the <strong>+</strong> icon to switch between Explain, Summarize, Describe, Analyze, Generate Description, and Audio.</p>
                    </div>
                  </div>
                  <div className="instruction-step">
                    <div className="step-number">2</div>
                    <div>
                      <h4>Type or Speak</h4>
                      <p>Type your prompt or click the <strong>Mic</strong> icon. Say <em>&quot;send it&quot;</em> to auto-send hands-free!</p>
                    </div>
                  </div>
                  <div className="instruction-step">
                    <div className="step-number">3</div>
                    <div>
                      <h4>Summarize YouTube Videos</h4>
                      <p>Paste a YouTube link → click <strong>Get Transcript</strong> → copy from YouTube → paste back → hit Send. Works best on desktop!</p>
                    </div>
                  </div>
                  <div className="instruction-step">
                    <div className="step-number">4</div>
                    <div>
                      <h4>Generate &amp; Listen</h4>
                      <p>Select <strong>Generate Audio (TTS)</strong> to have vAIbes speak the response out loud!</p>
                    </div>
                  </div>
                  <div className="instruction-step">
                    <div className="step-number">5</div>
                    <div>
                      <h4>Free Daily Limit</h4>
                      <p>Free accounts get <strong>10 requests per day</strong>. Resets every midnight. Upgrade to Pro for unlimited!</p>
                    </div>
                  </div>
                  <div className="instruction-step">
                    <div className="step-number">6</div>
                    <div>
                      <h4>AI Models &amp; Sources</h4>
                      <p>Use the right sidebar (or Models button on mobile) to visit ChatGPT, Gemini, and more!</p>
                    </div>
                  </div>
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