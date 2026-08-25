import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import './BillingPanel.css';

const BillingPanel = ({ onClose, embedded = false }) => {
  const { user } = useAuth();
  const [userTier, setUserTier] = useState('free');
  const [upgrading, setUpgrading] = useState(false);

  // GCash manual QR flow — no webhook exists for a personal QR transfer,
  // so this submits a claim for review instead of granting credits instantly.
  const [showGcashManual, setShowGcashManual] = useState(false);
  const [gcashRef, setGcashRef] = useState('');
  const [gcashStatus, setGcashStatus] = useState('idle'); // idle | submitting | submitted | error
  const [gcashError, setGcashError] = useState('');

  useEffect(() => {
    const fetchTier = async () => {
      if (!user?.id) return;
      try {
        const { data, error } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle();
        if (error) throw error;
        if (data?.plan) setUserTier(data.plan);
      } catch (err) {
        console.error('Error fetching user tier:', err);
        setUserTier('free');
      }
    };
    fetchTier();
  }, [user?.id]);

  // Helper to get the token once, used by both payment gateways
  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      alert('Your session has expired. Please sign in again.');
      throw new Error('Session expired');
    }
    return session.access_token;
  };

  const handleUpgrade = async () => {
    if (!user) return;
    setUpgrading(true);
    try {
      const token = await getAuthToken();
      
      const response = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // SECURE: Backend now verifies this
        },
        body: JSON.stringify({}) // Removed userId/email - backend extracts from JWT
      });
      
      const data = await response.json();
      if (data.url) window.open(data.url, '_blank');
      else alert('Could not create payment link: ' + (data.error || 'Unknown error'));
    } catch (error) {
      console.error('Payment error:', error);
      if (error.message !== 'Session expired') alert('Something went wrong. Please try again.');
    } finally {
      setUpgrading(false);
    }
  };

  const handleDodoUpgrade = async () => {
    if (!user) return;
    setUpgrading(true);
    try {
      const token = await getAuthToken();

      const response = await fetch('/api/create-dodo-checkout', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // SECURE: Backend now verifies this
        },
        body: JSON.stringify({}) // Removed userId/email - backend extracts from JWT
      });
      
      const data = await response.json();
      if (data.url) window.open(data.url, '_blank');
      else alert('Could not create checkout: ' + (data.error || 'Unknown error'));
    } catch (error) {
      console.error('Dodo payment error:', error);
      if (error.message !== 'Session expired') alert('Something went wrong. Please try again.');
    } finally {
      setUpgrading(false);
    }
  };

  const handleGcashSubmit = async (e) => {
    e.preventDefault();
    setGcashStatus('submitting');
    setGcashError('');
    try {
      const token = await getAuthToken();

      const response = await fetch('/api/submit-gcash-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ referenceNumber: gcashRef })
      });

      const data = await response.json();
      if (!response.ok) {
        setGcashStatus('error');
        setGcashError(data.error || 'Something went wrong. Please try again.');
        return;
      }
      setGcashStatus('submitted');
    } catch (error) {
      console.error('GCash claim error:', error);
      setGcashStatus('error');
      setGcashError(error.message === 'Session expired'
        ? 'Your session has expired. Please sign in again.'
        : 'Could not reach the server. Please try again.');
    }
  };

  const body = (
    <>
      <div className="billing-current-section">
        <div className="billing-current">
          <span className="billing-current-label">Current Plan</span>
          <span className={`billing-badge ${userTier}`}>{userTier.toUpperCase()}</span>
        </div>
        <p className="billing-usage">
          {/* Updated copy to reflect the new credit-wallet architecture instead of daily limits */}
          {userTier === 'pro' ? '✅ Pro access · All features unlocked' : 'Free plan — 3 daily trial credits'}
        </p>
      </div>

      <div className="billing-tiers">
        <div className={`billing-tier ${userTier === 'free' ? 'current-tier' : ''}`}>
          <div className="tier-header">
            <span className="tier-name">Free</span>
            <span className="tier-price">₱0 <small>/month</small></span>
          </div>
          <ul className="tier-features">
            <li>3 daily trial credits</li>
            <li>Study Mode (lo-fi, jazz, focus music, YouTube links)</li>
            <li>VidFeed — YouTube video feed</li>
            <li>EduFeed — view, like, comment, answer quizzes</li>
          </ul>
          {userTier === 'free' && <div className="tier-current-label">Your current plan</div>}
        </div>

        <div className={`billing-tier pro-tier ${userTier === 'pro' ? 'current-tier' : ''}`}>
          <div className="tier-badge-pro">BEST VALUE</div>
          <div className="tier-header">
            <span className="tier-name">Pro</span>
            <span className="tier-price">₱99 <small>/one-time</small></span>
          </div>
          <ul className="tier-features">
            <li>50 AI credits added to wallet</li>
            <li>All AI modes (Explain, Summarize, Analyze, Draft &amp; Edit, Quiz Me)</li>
            <li>Creative Workspace (rich editor, images, videos, files)</li>
            <li>Unified Messaging (DMs, groups, marketplace)</li>
            <li>Personal Vibe Wall</li>
            <li>Create EduFeed posts (notes, quizzes, flashcards)</li>
          </ul>
          {userTier !== 'pro' ? (
            <>
              <button className="upgrade-btn" onClick={handleUpgrade} disabled={upgrading}>
                {upgrading ? '⏳ Creating payment...' : '💳 PayMongo (QR Ph, GCash, Card)'}
              </button>
              <button className="upgrade-btn upgrade-btn-alt" onClick={handleDodoUpgrade} disabled={upgrading}>
                {upgrading ? '⏳ Creating checkout...' : '🌐 Dodo (Global)'}
              </button>
              <button
                className="upgrade-btn upgrade-btn-alt upgrade-btn-ghost"
                onClick={() => setShowGcashManual(v => !v)}
                disabled={upgrading}
              >
                📱 GCash QR (Manual)
              </button>

              {showGcashManual && (
                <div className="gcash-manual">
                  {gcashStatus === 'submitted' ? (
                    <p className="gcash-manual-success">
                      ✅ Thanks — we'll verify your payment and add your 50 credits shortly.
                    </p>
                  ) : (
                    <>
                      <img
                        src="/payments/gcash-qr.png"
                        alt="GCash QR code — scan to pay ₱99"
                        className="gcash-manual-qr"
                      />
                      <ol className="gcash-manual-steps">
                        <li>Open GCash and scan this QR code.</li>
                        <li>Send exactly ₱99.</li>
                        <li>Copy the reference number GCash shows you, then paste it below.</li>
                      </ol>
                      <form onSubmit={handleGcashSubmit} className="gcash-manual-form">
                        <input
                          type="text"
                          value={gcashRef}
                          onChange={(e) => setGcashRef(e.target.value)}
                          placeholder="GCash reference number"
                          aria-label="GCash reference number"
                          required
                        />
                        {gcashStatus === 'error' && (
                          <p className="gcash-manual-error" role="alert">{gcashError}</p>
                        )}
                        <button type="submit" className="upgrade-btn" disabled={gcashStatus === 'submitting'}>
                          {gcashStatus === 'submitting' ? '⏳ Submitting...' : "I've sent the payment"}
                        </button>
                      </form>
                      <p className="gcash-manual-note">
                        Credits are added once verified — usually within a few hours, not instantly.
                      </p>
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="tier-current-label pro">✅ You are on Pro</div>
          )}
        </div>
      </div>

      <p className="billing-note">💳 Secure payment · Credits never expire</p>
    </>
  );

  if (embedded) {
    return <div className="billing-panel-content is-embedded">{body}</div>;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="billing-panel-modal" onClick={e => e.stopPropagation()}>
        <div className="billing-panel-header">
          <h3>💳 Billing & Plan</h3>
          <button className="billing-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="billing-panel-content">{body}</div>
      </div>
    </div>
  );
};

export default BillingPanel;