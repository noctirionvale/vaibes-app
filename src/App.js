import React, { useEffect, useState, useRef } from 'react';
import LiveSlot from './components/LiveSlot';
import { createPortal } from 'react-dom';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { supabase } from './lib/supabase';
import LeftSidebar from './components/LeftSidebar';
import CreativeEditor from './components/CreativeEditor';
import AIComparison from './components/AIComparison';
import PanelSwitcher from './components/PanelSwitcher';
import MobileTopbar from './components/MobileTopbar';
import LandingPage from './components/LandingPage';
import SettingsModal from './components/SettingsModal';
import SharedCreative from './components/SharedCreative';
import SharedQuiz from './components/SharedQuiz';
import UserWall from './components/UserWall';
import BillingPanel from './components/BillingPanel';
import AuthModal from './components/AuthModal';
import CommunityRoomPlay from './components/CommunityRoomPlay';
import CommunityRoomCreator from './components/CommunityRoomCreator';
import useIsMobile from './hooks/useIsMobile';
import { VaibeyProvider } from './context/VaibeyContext';
import EduFeed from './components/EduFeed';
import VidFeed from './components/VidFeed';
import { MusicPlayerProvider } from './context/MusicPlayerContext';
import { useOnboardingTour } from './hooks/useOnboardingTour';
import OnboardingFlow from './components/OnboardingFlow';
import './styles/App.css';

const INTENT_TO_TAB = {
  explain: 'aichat',
  quiz: 'edufeed',
  study_room: 'edufeed', // Community Rooms live inside EduFeed's own tabs, not a separate centerView
  exploring: 'userwall',
};

const AppShellContent = () => {
  const isMobile = useIsMobile();
  const { user, profile } = useAuth(); // Single source of truth for auth state
  
  // Wire onboarding tour at the top level (Rules of Hooks)
  useOnboardingTour(user, profile, isMobile);

  const [showSettings, setShowSettings] = useState(false);
  const [showBilling, setShowBilling] = useState(false);
  const [showRoomPlay, setShowRoomPlay] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [userTier, setUserTier] = useState('free');
  const [refreshWall, setRefreshWall] = useState(false);

  const [wallEditItem, setWallEditItem] = useState(null);
  const [eduEditItem, setEduEditItem] = useState(null);
  const [mobileEditItem, setMobileEditItem] = useState(null);
  const [communityEditItem, setCommunityEditItem] = useState(null);
  const [showCommunityEditor, setShowCommunityEditor] = useState(false);
  const [showEduEditorModal, setShowEduEditorModal] = useState(false);

  const [rightPanelView, setRightPanelView] = useState('creative');
  const [centerView, setCenterView] = useState('userwall');
  const [forceCreativeEditorInCenter, setForceCreativeEditorInCenter] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  // ── Live slots: VidFeed & EduFeed mount ONCE and stay mounted regardless
  // of whether they're currently shown center or right — swapping only
  // repositions a fixed overlay onto the active placeholder. ──
  const centerVidSlotRef = useRef(null);
  const rightVidSlotRef = useRef(null);
  const centerEduSlotRef = useRef(null);
  const rightEduSlotRef = useRef(null);

  // ── Fetch user tier ──
  useEffect(() => {
    const fetchTier = async () => {
      if (!user?.id) { 
        setUserTier('free'); 
        return; 
      }
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('plan')
          .eq('id', user.id)
          .maybeSingle();
        if (!error && data?.plan) setUserTier(data.plan);
        else setUserTier('free');
      } catch (err) {
        console.error('Error fetching user tier:', err);
        setUserTier('free');
      }
    };
    fetchTier();
  }, [user]);

  useEffect(() => {
    const handleOpenBilling = () => setShowBilling(true);
    window.addEventListener('open-billing', handleOpenBilling);
    return () => window.removeEventListener('open-billing', handleOpenBilling);
  }, []);

  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    const handleOpenAuth = () => setShowAuthModal(true);
    window.addEventListener('open-auth', handleOpenAuth);
    return () => window.removeEventListener('open-auth', handleOpenAuth);
  }, []);

  // ── Service worker cleanup ──
  useEffect(() => {
    supabase.auth.getSession();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(reg => reg.unregister());
      });
    }
  }, []);

  // ── Handlers ──
  const handleRefreshWall = () => setRefreshWall(prev => !prev);
  const handleInjectToCanvas = (content) => console.log('Inject to canvas:', content);

  const handleEditItem = (item) => {
    if (isMobile) { 
      setMobileEditItem(item); 
      return; 
    }
    setWallEditItem(item);
    setForceCreativeEditorInCenter(true);
  };

  const handleWallEditDone = () => {
    setWallEditItem(null);
    setForceCreativeEditorInCenter(false);
    handleRefreshWall();
  };

  const handleMobileEditDone = () => {
    setMobileEditItem(null);
    handleRefreshWall();
  };

  const handleEditEduPost = async (post) => {
    if (!post) {
      setEduEditItem(null);
      setShowEduEditorModal(true);
      return;
    }

    if (post.type === 'community' || post.community_data?.is_community) {
      if (!post.community_id) return;
      const { data, error } = await supabase
        .from('community_rooms')
        .select('*')
        .eq('id', post.community_id)
        .single();
      if (error || !data) { 
        console.error('Failed to load room for editing:', error); 
        return; 
      }
      setCommunityEditItem(data);
      setShowCommunityEditor(true);
      return;
    }

    setEduEditItem({
      id: post.id,
      title: post.title || '',
      content: post.content || '',
      attachments: post.attachments || [],
      subject: post.subject || 'General',
      type: post.type || 'note',
      quiz_data: post.quiz_data || null,
      _table: 'edufeed_posts',
    });
    setShowEduEditorModal(true);
  };

  const handleCommunityEditDone = () => {
    setShowCommunityEditor(false);
    setCommunityEditItem(null);
    handleRefreshWall();
  };

  const handleEduEditDone = () => {
    setEduEditItem(null);
    setShowEduEditorModal(false);
    handleRefreshWall();
  };

  // ── Direct swap: whatever you click becomes the new CENTER content,
  // and whatever was in center gets bumped into the right panel.
  // Works identically for all 4 rotating views — no relaying through the old
  // right-panel value, which is what caused the "click twice" bug.
  // UserWall isn't one of the 4 rotating tabs, so it never gets pushed into
  // the right panel; tapping the already-active tab returns you to the wall. ──
  const switchRightPanel = (view) => {
    const currentCenterKey = forceCreativeEditorInCenter ? 'creative' : centerView;

    if (view === currentCenterKey) {
      setCenterView('userwall');
      setForceCreativeEditorInCenter(false);
      setRightPanelView('creative'); // restore the default pairing every time userwall becomes center
      return;
    }

    // Wherever the CreativeEditor currently sits, clear its edit-item —
    // it's about to be displaced and the in-progress edit doesn't follow it.
    if (forceCreativeEditorInCenter || centerView === 'creative') {
      setWallEditItem(null);
    }
    if (rightPanelView === 'creative' && view !== 'creative') {
      setEduEditItem(null);
    }

    setCenterView(view);
    if (currentCenterKey !== 'userwall') {
      setRightPanelView(currentCenterKey);
    }
    setForceCreativeEditorInCenter(false);
  };

  // ── Room handlers ──
  const handleRoomClose = () => {
    setShowRoomPlay(false);
    setActiveRoomId(null);
  };

  // ── Props ──
  const aiComparisonProps = {
    onOpenUpgrade: () => setShowBilling(true),
    onInjectToCanvas: handleInjectToCanvas,
  };

  const centerCreativeEditorProps = {
    onContentCreated: handleRefreshWall,
    userTier,
    onOpenBilling: () => setShowBilling(true),
    editItem: wallEditItem,
    onEditDone: handleWallEditDone,
    draftKey: 'wall',
  };

  const rightCreativeEditorProps = {
    onContentCreated: handleRefreshWall,
    userTier,
    onOpenBilling: () => setShowBilling(true),
    editItem: eduEditItem,
    onEditDone: handleEduEditDone,
    draftKey: 'edufeed',
  };

  // ── Center content: covers all 5 states (4 rotating tabs + userwall) ──
  let centerColumnContent;
  if (forceCreativeEditorInCenter) {
    centerColumnContent = <CreativeEditor {...centerCreativeEditorProps} />;
  } else {
    switch (centerView) {
      case 'creative':
        centerColumnContent = <CreativeEditor {...centerCreativeEditorProps} />;
        break;
      case 'edufeed':
        centerColumnContent = <div ref={centerEduSlotRef} style={{ width: '100%', height: '100%' }} />;
        break;
      case 'vidfeed':
        centerColumnContent = <div ref={centerVidSlotRef} style={{ width: '100%', height: '100%' }} />;
        break;
      case 'aichat':
        centerColumnContent = <AIComparison {...aiComparisonProps} />;
        break;
      case 'userwall':
      default:
        centerColumnContent = <UserWall refreshTrigger={refreshWall} onEditItem={handleEditItem} />;
    }
  }

  // Which of the 4 rotating tabs (if any) is currently the big center
  // view — drives PanelSwitcher's "active" tab. null when center shows
  // UserWall, since none of the tabs correspond to it.
  const centerActiveKey = forceCreativeEditorInCenter
    ? 'creative'
    : (centerView === 'userwall' ? null : centerView);

  const vidfeedLocation = centerActiveKey === 'vidfeed' ? 'center' : (rightPanelView === 'vidfeed' ? 'right' : null);
  const edufeedLocation = centerActiveKey === 'edufeed' ? 'center' : (rightPanelView === 'edufeed' ? 'right' : null);
  
  // Reuses the exact same wrapper classes the old single-instance render
  // used, so all existing .center-view-wrapper--X / .panel-content-wrapper
  // CSS (clipping, layout) still applies to the live component's subtree.
  const feedHostClass = (location, key) =>
    location === 'right'
      ? 'panel-content-wrapper'
      : `center-view-wrapper center-view-wrapper--feed center-view-wrapper--${key}`;

  // ── If room is active, show it as overlay ──
  if (showRoomPlay && activeRoomId) {
    return (
      <div className="room-overlay">
        <CommunityRoomPlay
          roomId={activeRoomId}
          onClose={handleRoomClose}
        />
      </div>
    );
  }

  if (showCommunityEditor && communityEditItem) {
    return (
      <div className="room-overlay">
        <CommunityRoomCreator
          editItem={communityEditItem}
          onRoomCreated={handleCommunityEditDone}
          onClose={handleCommunityEditDone}
        />
      </div>
    );
  }

  if (!profile?.onboarding_completed && !onboardingComplete) {
    return (
      <OnboardingFlow
        onComplete={({ intent }) => {
          setCenterView(INTENT_TO_TAB[intent] || 'userwall');
          setOnboardingComplete(true);
        }}
      />
    );
  }

  // ── Main app layout ──
  return (
    <>
      {isMobile && (
        <MobileTopbar
          userTier={userTier}
          onOpenUpgrade={() => setShowBilling(true)}
          editItem={mobileEditItem}
          onEditDone={handleMobileEditDone}
          onRefreshWall={handleRefreshWall}
          onEditEduPost={handleEditEduPost}
        />
      )}

      {!isMobile && (
        <>
          <div className="main-wrapper">
            <LeftSidebar />
            <main className="content-center">
              <div className="chatbox-wrapper">
                <div
                  className={
                    !forceCreativeEditorInCenter && (centerView === 'vidfeed' || centerView === 'edufeed')
                      ? `center-view-wrapper center-view-wrapper--feed center-view-wrapper--${centerView}`
                      : 'center-view-wrapper'
                  }
                >
                  {centerColumnContent}
                </div>
              </div>
            </main>

            <div className="right-panel">
              <PanelSwitcher
                activeView={rightPanelView}
                centerActiveKey={centerActiveKey}
                onViewChange={switchRightPanel}
                creativeEditorProps={rightCreativeEditorProps}
                aiComparisonProps={aiComparisonProps}
                userTier={userTier}
                vidSlotRef={rightVidSlotRef}
                eduSlotRef={rightEduSlotRef}
              />
            </div>
          </div>

          {vidfeedLocation && (
            <LiveSlot
              slotRef={vidfeedLocation === 'center' ? centerVidSlotRef : rightVidSlotRef}
              hostClassName={feedHostClass(vidfeedLocation, 'vidfeed')}
            >
              <VidFeed compact={vidfeedLocation === 'right'} />
            </LiveSlot>
          )}

          {edufeedLocation && (
            <LiveSlot
              slotRef={edufeedLocation === 'center' ? centerEduSlotRef : rightEduSlotRef}
              hostClassName={feedHostClass(edufeedLocation, 'edufeed')}
            >
              <EduFeed userTier={userTier} onEditPost={handleEditEduPost} />
            </LiveSlot>
          )}
        </>
      )}

      {showEduEditorModal && createPortal(
        <div className="modal-overlay" onClick={handleEduEditDone}>
          <div className="modal-content ef-quiz-play-modal" onClick={e => e.stopPropagation()}>
            <button className="ef-quiz-play-close" onClick={handleEduEditDone} aria-label="Close">✕</button>
            <CreativeEditor key={eduEditItem?.id || 'new-edufeed-post'} {...rightCreativeEditorProps} />
          </div>
        </div>,
        document.body
      )}

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}

      {showBilling && <BillingPanel onClose={() => setShowBilling(false)} />}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onOpenBilling={() => setShowBilling(true)}
        />
      )}
    </>
  );
};

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <VaibeyProvider>
            <MusicPlayerProvider>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/app" element={<AppShellContent />} />
                <Route path="/share/:id" element={<SharedCreative />} />
                <Route path="/share/quiz/:id" element={<SharedQuiz />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </MusicPlayerProvider>
          </VaibeyProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;