import { useEffect, useRef } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { supabase } from '../lib/supabase';

const DESKTOP_STEPS = [
  { 
    element: '[data-tour="panel-tab-creative"]', 
    popover: { title: 'Create', description: 'Write notes, essays, or build quizzes and flashcards for EduFeed.' } 
  },
  { 
    element: '[data-tour="panel-tab-aichat"]', 
    popover: { title: 'AI Chat', description: 'Ask Vaibey to explain, summarize, analyze, draft, or quiz you — with real memory of your notes.' } 
  },
  { 
    element: '[data-tour="panel-tab-edufeed"]', 
    popover: { title: 'EduFeed', description: 'Play quizzes and flashcards made by the community — or join a live room.' } 
  },
  { 
    element: '[data-tour="panel-tab-vidfeed"]', 
    popover: { title: 'VidFeed', description: 'Your own YouTube feed — no algorithm, just the channels you pick.' } 
  },
  { 
    element: '[data-tour="sidebar-profile"]', 
    popover: { title: 'Your profile', description: 'Settings and sign-out live here.' } 
  },
  { 
    element: '[data-tour="study-widget"]', 
    popover: { title: 'Study Widget', description: 'Lo-fi, jazz, or nature sounds, plus a clock and focus timer — always docked here.' } 
  },
];

const MOBILE_STEPS = [
  { element: '[data-tour="nav-home"]', popover: { title: 'AI Chat', description: 'Ask Vaibey to explain, summarize, analyze, draft, or quiz you.' } },
  { element: '[data-tour="nav-creative"]', popover: { title: 'Create', description: 'Write notes, build quizzes, or start a live room.' } },
  { element: '[data-tour="nav-edufeed"]', popover: { title: 'EduFeed', description: 'Play quizzes and flashcards made by the community.' } },
  { element: '[data-tour="nav-vidfeed"]', popover: { title: 'VidFeed', description: 'Your own YouTube feed — no algorithm, just channels you pick.' } },
  { element: '[data-tour="nav-wall"]', popover: { title: 'My Wall', description: 'Everything you\'ve created lives here.' } },
];

export function useOnboardingTour(user, profile, isMobile) {
  const startedRef = useRef(false);

  useEffect(() => {
    if (!user || !profile || profile.onboarding_seen || startedRef.current) return;
    startedRef.current = true;

    const markDone = async () => {
      // Added await for proper async handling, though fire-and-forget works here too
      await supabase.from('profiles').update({ onboarding_seen: true }).eq('id', user.id);
    };

    const tour = driver({
      showProgress: true,
      allowClose: true,
      showButtons: ['next', 'previous', 'close'],
      overlayOpacity: 0.65,
      steps: isMobile ? MOBILE_STEPS : DESKTOP_STEPS,
      onDestroyed: markDone,
    });

    const id = setTimeout(() => tour.drive(), 500); // let layout settle first
    return () => clearTimeout(id);
  }, [user, profile, isMobile]);
}