import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import AuthModal from './AuthModal';
import SettingsModal from './SettingsModal';
import StudyWidget from './StudyWidget';
import CreativeEditor from './CreativeEditor';
import EduFeed from './EduFeed';
import CommunityRoomPlay from './CommunityRoomPlay';
import VidFeed from './VidFeed';
import UserWall from './UserWall';
import AIComparison from './AIComparison';
import './MobileTopbar.css';

// ── Icons ──
const IconHome = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
  </svg>
);

const IconPencil = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const IconFeed = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16v16H4z"/>
    <line x1="8" y1="8" x2="16" y2="8"/>
    <line x1="8" y1="12" x2="16" y2="12"/>
    <line x1="8" y1="16" x2="12" y2="16"/>
  </svg>
);

const IconVideo = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2"/>
    <polygon points="10 8 16 12 10 16 10 8"/>
  </svg>
);

const IconWall = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <line x1="3" y1="9" x2="21" y2="9"/>
    <line x1="3" y1="15" x2="21" y2="15"/>
    <line x1="9" y1="3" x2="9" y2="21"/>
    <line x1="15" y1="3" x2="15" y2="21"/>
  </svg>
);

const DEFAULT_TAB_ORDER = ['home', 'creative', 'edufeed', 'vidfeed', 'wall'];
const TAB_ORDER_KEY = 'vaibes_mobile_tab_order_v1';

const loadTabOrder = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(TAB_ORDER_KEY));
    if (Array.isArray(saved) && saved.length) return saved;
  } catch { /* ignore */ }
  return DEFAULT_TAB_ORDER;
};

const MobileTopbar = ({ 
  onShareToDM, 
  userTier, 
  onOpenUpgrade, 
  editItem, 
  onEditDone,
  onRefreshWall,
  onEditEduPost,
}) => {
  const { user, profile } = useAuth();
  
  // ── Bottom Nav State ──
  const [activeTab, setActiveTab] = useState('home');
  
  // ── Modals state ──
  const [showAuthModal,  setShowAuthModal]  = useState(false);
  const [showSettings,   setShowSettings]   = useState(false);
  const [showStudy,      setShowStudy]      = useState(false);
  const [showCreative,   setShowCreative]   = useState(false);
  const [showEduFeed,    setShowEduFeed]    = useState(false);
  const [showVidFeed,    setShowVidFeed]    = useState(false);
  const [showUserWall,   setShowUserWall]   = useState(false);
  const [showRacePlay, setShowRacePlay] = useState(false);
  const [raceRoomId, setRaceRoomId] = useState(null);

  // ── State for UserWall editing ──
  const [wallEditItem, setWallEditItem] = useState(null);
  const [refreshWall, setRefreshWall] = useState(false);

  // ── Bottom nav reorder state ──
  const [tabOrder, setTabOrder]     = useState(loadTabOrder);
  const [reorderMode, setReorderMode] = useState(false);
  const [draggingId, setDraggingId] = useState(null);
  const navRef = useRef(null);
  const longPressTimer = useRef(null);
  const touchStartPos  = useRef({ x: 0, y: 0 });

  useEffect(() => {
    try { localStorage.setItem(TAB_ORDER_KEY, JSON.stringify(tabOrder)); } catch { /* storage unavailable */ }
  }, [tabOrder]);

  // ── Auto-open creative sheet when editItem arrives from parent ──
  useEffect(() => {
    if (editItem) {
      setShowCreative(true);
      setWallEditItem(editItem);
    }
  }, [editItem]);

  const avatarUrl   = profile?.avatar_url || user?.user_metadata?.avatar_url;
  const displayName = profile?.display_name || user?.user_metadata?.full_name ||
    user?.user_metadata?.name || user?.email?.split('@')[0];

  const handleCreativeClose = () => {
    setShowCreative(false);
    setWallEditItem(null);
    if (onEditDone) onEditDone();
    if (onRefreshWall) onRefreshWall();
  };

  const handleWallEditDone = () => {
    setWallEditItem(null);
    setShowCreative(false);
    setRefreshWall(prev => !prev);
    if (onEditDone) onEditDone();
    if (onRefreshWall) onRefreshWall();
  };

  const handleEduEdit = (post) => {
    const isCommunity = post && (post.type === 'community' || post.community_data?.is_community);

    if (isCommunity) {
      if (onEditEduPost) onEditEduPost(post);
      return;
    }

    setWallEditItem(post ? {
      id: post.id,
      title: post.title || '',
      content: post.content || '',
      attachments: post.attachments || [],
      subject: post.subject || 'General',
      type: post.type || 'note',
      quiz_data: post.quiz_data || null,
      _table: 'edufeed_posts',
    } : null);
    setShowCreative(true);
  };

  const clearLongPress = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };

  const startLongPress = (id) => {
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      setReorderMode(true);
      setDraggingId(id);
      navigator.vibrate?.(10);
    }, 450);
  };

  const handleTouchStart = (id) => (e) => {
    const t = e.touches[0];
    touchStartPos.current = { x: t.clientX, y: t.clientY };
    if (reorderMode) setDraggingId(id);
    else startLongPress(id);
  };

  const handleTouchMove = (e) => {
    const t = e.touches[0];
    if (!draggingId && longPressTimer.current) {
      const dx = Math.abs(t.clientX - touchStartPos.current.x);
      const dy = Math.abs(t.clientY - touchStartPos.current.y);
      if (dx > 10 || dy > 10) clearLongPress(); // real scroll, not a hold — cancel
      return;
    }
    if (!draggingId || !navRef.current) return;
    if (e.cancelable) e.preventDefault();
    const rect = navRef.current.getBoundingClientRect();
    const itemWidth = rect.width / orderedTabs.length;
    let targetIndex = Math.floor((t.clientX - rect.left) / itemWidth);
    targetIndex = Math.max(0, Math.min(orderedTabs.length - 1, targetIndex));
    const currentIndex = tabOrder.indexOf(draggingId);
    if (targetIndex !== currentIndex && currentIndex !== -1) {
      const next = [...tabOrder];
      next.splice(currentIndex, 1);
      next.splice(targetIndex, 0, draggingId);
      setTabOrder(next);
    }
  };

  const handleTouchEnd = () => {
    clearLongPress();
    setDraggingId(null);
  };

  // ── AIComparison props ──
  const aiComparisonProps = {
    onOpenUpgrade: onOpenUpgrade,
    onInjectToCanvas: () => {},
  };

  // ── Bottom Nav Tabs (6 tabs) ──
 const tabs = [
  { id: 'home', icon: <IconHome />, label: 'AIchat', action: () => setActiveTab('home'), component: <AIComparison {...aiComparisonProps} /> },
  {
    id: 'creative',
    icon: <IconPencil />,
    label: 'Create',
    action: () => {
      if (userTier !== 'pro' && user?.email !== 'noctirionvale@gmail.com') {
        onOpenUpgrade?.();
        return;
      }
      setShowCreative(true);
    },
  },
  { id: 'edufeed', icon: <IconFeed />, label: 'EduFeed', action: () => { setShowEduFeed(true); } },
  { id: 'vidfeed', icon: <IconVideo />, label: 'VidFeed', action: () => { setShowVidFeed(true); } },
  { id: 'wall', icon: <IconWall />, label: 'My Wall', action: () => { setShowUserWall(true); } },
];

  const orderedTabs = tabOrder
    .filter(id => tabs.some(t => t.id === id))
    .concat(tabs.map(t => t.id).filter(id => !tabOrder.includes(id)))
    .map(id => tabs.find(t => t.id === id));

  // ── Get active component ──
  const activeComponent = tabs.find(tab => tab.id === activeTab)?.component || tabs[0].component;

  return (
    <>
      {/* ── TOP BAR ── */}
      <div className="mobile-topbar">
        <div className="mobile-brand">
          <img src="/hero.ai.png" alt="vAIbes" className="mobile-logo" />
          <span className="mobile-brand-name">vAIbes</span>
        </div>

        <button className="mobile-study-center-btn" onClick={() => setShowStudy(true)} title="Study Station">
          <span style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '0.5px' }}>SW</span>
        </button>

        <div className="mobile-topbar-right">
          {user ? (
            <div className="mobile-avatar-wrap" onClick={() => setShowSettings(true)}>
              {avatarUrl
                ? <img src={avatarUrl} alt="avatar" className="mobile-avatar" />
                : <div className="mobile-avatar-placeholder">{displayName?.charAt(0).toUpperCase()}</div>
              }
            </div>
          ) : (
            <button className="mobile-login-btn" onClick={() => setShowAuthModal(true)}>Sign In</button>
          )}
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="mobile-main-content">
        {activeComponent}
      </div>

      {/* ── BOTTOM NAV ── */}
      {reorderMode && (
        <div className="mobile-reorder-bar">
          <span>✋ Drag to reorder</span>
          <button className="mobile-reorder-done" onClick={() => { setReorderMode(false); setDraggingId(null); }}>Done</button>
        </div>
      )}

      <div
        className={`bottom-nav ${reorderMode ? 'reorder-active' : ''}`}
        ref={navRef}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {orderedTabs.map(tab => (
  <button
    key={tab.id}
    data-tour={`nav-${tab.id}`}
    className={`bottom-nav-item ${activeTab === tab.id ? 'active' : ''} ${reorderMode ? 'reorder-jiggle' : ''} ${draggingId === tab.id ? 'dragging' : ''}`}
    onTouchStart={handleTouchStart(tab.id)}
    onClick={() => { if (!reorderMode) tab.action(); }}
  >
            <span className="bottom-nav-icon">{tab.icon}</span>
            <span className="bottom-nav-label">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── STUDY WIDGET SHEET ── */}
      {showStudy && (
        <>
          <div className="mobile-modal-overlay" onClick={() => setShowStudy(false)} />
          <div className="mobile-bottom-sheet study-sheet full-sheet">
            <div className="mobile-sheet-handle" />
            <div className="mobile-sheet-header" style={{ justifyContent: 'space-between' }}>
              <span className="mobile-sheet-label">🎓 Study Station</span>
              <button className="mobile-sheet-close" onClick={() => setShowStudy(false)}>✕</button>
            </div>
            <div className="mobile-sheet-body full-sheet-body study-sheet-body">
              <StudyWidget userTier={userTier} />
            </div>
          </div>
        </>
      )}

      {/* ── CREATIVE EDITOR SHEET ── */}
      {showCreative && (
        <>
          <div className="mobile-modal-overlay" onClick={handleCreativeClose} />
          <div className="mobile-bottom-sheet creative-sheet full-sheet">
            <div className="mobile-sheet-handle" />
            <div className="mobile-sheet-header">
              <span>{wallEditItem ? '✏️ Edit Creation' : 'Creative Workspace'}</span>
              <button className="mobile-sheet-close" onClick={handleCreativeClose}>✕</button>
            </div>
            <div className="mobile-sheet-body full-sheet-body">
              <CreativeEditor
                onShareToDM={onShareToDM}
                onClose={handleCreativeClose}
                onContentCreated={() => { 
                  handleCreativeClose();
                  setRefreshWall(prev => !prev);
                }}
                userTier={userTier}
                onOpenBilling={onOpenUpgrade}
                editItem={wallEditItem}
                onEditDone={handleWallEditDone}
              />
            </div>
          </div>
        </>
      )}

      {/* ── USER WALL SHEET ── */}
      {showUserWall && (
        <>
          <div className="mobile-modal-overlay" onClick={() => setShowUserWall(false)} />
          <div className="mobile-bottom-sheet userwall-sheet full-sheet">
            <div className="mobile-sheet-handle" />
            <div className="mobile-sheet-header">
              <span>🧱 My Wall</span>
              <button className="mobile-sheet-close" onClick={() => setShowUserWall(false)}>✕</button>
            </div>
            <div className="mobile-sheet-body full-sheet-body">
              <UserWall
                refreshTrigger={refreshWall}
                onEditItem={(item) => {
                  setWallEditItem(item);
                  setShowUserWall(false);
                  setShowCreative(true);
                }}
              />
            </div>
          </div>
        </>
      )}

      {/* ── EDUFEED SHEET ── */}
      {showEduFeed && (
        <>
          <div className="mobile-modal-overlay" onClick={() => setShowEduFeed(false)} />
          <div className="mobile-bottom-sheet edufeed-sheet full-sheet">
            <div className="mobile-sheet-handle" />
            <div className="mobile-sheet-header">
              <span>🎓 EduFeed</span>
              <button className="mobile-sheet-close" onClick={() => setShowEduFeed(false)}>✕</button>
            </div>
            <div className="mobile-sheet-body full-sheet-body">
              <EduFeed 
                userTier={userTier}
                onEditPost={handleEduEdit}
                onOpenRacePlay={(roomId) => {
                  setShowEduFeed(false);
                  setRaceRoomId(roomId);
                  setShowRacePlay(true);
                }}
              />
            </div>
          </div>
        </>
      )}

      {/* ── COMMUNITY RACE PLAY SHEET ── */}
      {showRacePlay && raceRoomId && (
        <>
          <div className="mobile-modal-overlay" onClick={() => setShowRacePlay(false)} />
          <div className="mobile-bottom-sheet raceplay-sheet full-sheet">
            <div className="mobile-sheet-handle" />
            <div className="mobile-sheet-header">
              <span>🏁 Live Race</span>
              <button className="mobile-sheet-close" onClick={() => setShowRacePlay(false)}>✕</button>
            </div>
            <div className="mobile-sheet-body full-sheet-body">
              <CommunityRoomPlay 
                roomId={raceRoomId} 
                onClose={() => setShowRacePlay(false)} 
              />
            </div>
          </div>
        </>
      )}

      {/* ── VIDFEED SHEET ── */}
      {showVidFeed && (
        <>
          <div className="mobile-modal-overlay" onClick={() => setShowVidFeed(false)} />
          <div className="mobile-bottom-sheet vidfeed-sheet full-sheet">
            <div className="mobile-sheet-handle" />
            <div className="mobile-sheet-header">
              <span>🎥 VidFeed</span>
              <button className="mobile-sheet-close" onClick={() => setShowVidFeed(false)}>✕</button>
            </div>
            <div className="mobile-sheet-body full-sheet-body">
              <VidFeed compact={false} />
            </div>
          </div>
        </>
      )}

      {/* ── SETTINGS MODAL ── */}
      {showSettings && (
        <SettingsModal 
          onClose={() => setShowSettings(false)} 
          onOpenBilling={onOpenUpgrade}
        />
      )}

      {/* ── AUTH MODAL ── */}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </>
  );
};

export default MobileTopbar;