// src/components/UnifiedMessaging/UnifiedMessaging.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import ConversationList from './ConversationList';
import LiveGroupsList   from './LiveGroupsList';
import ShopProductList  from './ShopProductList';
import InlineChatView   from './InlineChatView';

const ADMIN_EMAIL = 'noctirionvale@gmail.com';

const UnifiedMessaging = ({ onOpenBilling, instanceId = 'default' }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dms');
  const [activeChat, setActiveChat] = useState(null);

  // BUG FIX: this used to be hard-coded `const userTier = 'free'`, which
  // meant every Pro/Scholar subscriber saw the paywall on DMs & Live —
  // the component never actually checked their real plan. Now it fetches
  // `profiles.plan` + `profiles.is_dev`, matching the isPro pattern used
  // elsewhere in the app ('pro' | 'scholar' | is_dev true = unlocked).
  const [profile, setProfile] = useState(null); // null while loading

  useEffect(() => {
    let cancelled = false;
    const fetchProfile = async () => {
      if (!user?.id) { if (!cancelled) setProfile({ plan: 'free', is_dev: false }); return; }
      const { data, error } = await supabase
        .from('profiles').select('plan, is_dev').eq('id', user.id).maybeSingle();
      if (!cancelled) {
        setProfile({
          plan: !error && data?.plan ? data.plan : 'free',
          is_dev: !!data?.is_dev,
        });
      }
    };
    fetchProfile();
    return () => { cancelled = true; };
  }, [user?.id]);

  const tierLoading = profile === null;
  const isDev    = (profile?.is_dev) || user?.email === ADMIN_EMAIL;
  const isPro    = !!profile && ['pro', 'scholar'].includes(profile.plan);
  const isLocked = !tierLoading && !isPro && !isDev;

  const openDm      = (conversation, otherUser) => setActiveChat({ type: 'dm', conversation, otherUser });
  const openGroup   = (group)   => setActiveChat({ type: 'group', group });
  const openProduct = (product) => setActiveChat({ type: 'product', product });
  const closeChat   = () => setActiveChat(null);

  return (
    <div className="um-container">
      <div className="um-tabs">
        <button
          className={`um-tab ${activeTab === 'dms' ? 'active' : ''}`}
          onClick={() => { if (isLocked) { onOpenBilling?.(); return; } setActiveTab('dms'); setActiveChat(null); }}
          title="Direct Messages"
        >
          <span className="um-tab-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </span>
          <span className="um-tab-label">DMs</span>
        </button>

        <button
          className={`um-tab ${activeTab === 'live' ? 'active' : ''}`}
          onClick={() => { if (isLocked) { onOpenBilling?.(); return; } setActiveTab('live'); setActiveChat(null); }}
          title="Live & Groups"
        >
          <span className="um-tab-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="2"/>
              <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/>
            </svg>
          </span>
          <span className="um-tab-label">Live</span>
          <span className="um-live-dot" />
        </button>

        <button
          className={`um-tab ${activeTab === 'shop' ? 'active' : ''}`}
          onClick={() => { setActiveTab('shop'); setActiveChat(null); }}
          title="Student Shop"
        >
          <span className="um-tab-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
          </span>
          <span className="um-tab-label">Shop</span>
        </button>
      </div>

      <div className="um-content">
        {!activeChat && tierLoading && (
          <div className="um-list-empty"><span>⏳</span><p>Loading…</p></div>
        )}

        {!activeChat && !tierLoading && isLocked && activeTab !== 'shop' && (
          <div className="um-paywall">
            <div className="um-paywall-icon">💬</div>
            <h4>Pro Feature</h4>
            <p>Upgrade to chat with others and join live study sessions.</p>
            <button className="um-upgrade-btn" onClick={() => onOpenBilling?.()}>Upgrade to Pro</button>
            <button className="um-shop-anyway" onClick={() => setActiveTab('shop')}>Browse Shop (free)</button>
          </div>
        )}

        {activeChat && (
          <InlineChatView
            type={activeChat.type}
            conversation={activeChat.conversation}
            otherUser={activeChat.otherUser}
            group={activeChat.group}
            product={activeChat.product}
            onBack={closeChat}
          />
        )}

        {!activeChat && !tierLoading && (!isLocked || activeTab === 'shop') && (
          <>
            {activeTab === 'dms'  && (
              <ConversationList
                onSelect={openDm}
                onOpenBilling={onOpenBilling}
                instanceId={instanceId}
              />
            )}
            {activeTab === 'live' && <LiveGroupsList   onSelectGroup={openGroup} onOpenBilling={onOpenBilling} />}
            {activeTab === 'shop' && <ShopProductList  onShareProduct={openProduct} />}
          </>
        )}
      </div>
    </div>
  );
};

export default UnifiedMessaging;