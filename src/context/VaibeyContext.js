import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const VaibeyContext = createContext();

export const useVaibey = () => {
  const context = useContext(VaibeyContext);
  if (!context) {
    throw new Error('useVaibey must be used within a VaibeyProvider');
  }
  return context;
};

const CACHE_DURATION_MS = 2 * 60 * 1000; // 2 minutes

export const VaibeyProvider = ({ children }) => {
  const { user } = useAuth();
  const [userData, setUserData] = useState({
    notes: [],
    messages: [],
    quizHistory: [],
    studyTopics: [],
    recentActivity: []
  });
  const [loading, setLoading] = useState(true);
  const [lastScan, setLastScan] = useState(null);
  
  // ✅ Freshness cache ref — survives re-renders without triggering them
  const lastScanRef = useRef(null);
 

  // ── Scan ALL user data with freshness check ──
  const scanUserData = useCallback(async (force = false) => {
    if (!user) return;

    // ✅ Skip redundant scans within 2 min unless caller forces a refresh
    if (!force && lastScanRef.current && Date.now() - lastScanRef.current < CACHE_DURATION_MS) {
      console.log('⏭️ Vaibey scan skipped (cache still fresh)');
      return;
    }

    setLoading(true);
    
    try {
      // 1. Fetch Creative Wall notes — ✅ TYPE FILTER ADDED
      const { data: notes } = await supabase
        .from('user_creatives')
        .select('id, title, content, subject, created_at, media_type')
        .eq('user_id', user.id)
        .eq('media_type', 'note')   // ✅ Only fetch notes, not videos/images/youtube
        .order('created_at', { ascending: false })
        .limit(50);

      // 2. Fetch recent messages
      const { data: messages } = await supabase
        .from('direct_messages')
        .select('content, created_at')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(50);

      // 3. Fetch quiz history
      const { data: quizzes } = await supabase
        .from('user_quiz_results')
        .select('*')
        .eq('user_id', user.id)
        .order('attempted_at', { ascending: false })
        .limit(50);

      // 4. Fetch study topics from activity log
      const { data: activity } = await supabase
        .from('user_activity_log')
        .select('subject, activity_type, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      // 5. Extract unique topics
      const topics = activity
        ?.filter(a => a.subject)
        .map(a => a.subject) || [];

      // 6. Get recent activity summary
      const recentActivity = activity?.slice(0, 10) || [];

      setUserData({
        notes: notes || [],
        messages: messages || [],
        quizHistory: quizzes || [],
        studyTopics: [...new Set(topics)],
        recentActivity: recentActivity,
        lastUpdated: new Date().toISOString()
      });

      // ✅ Update cache timestamp
      lastScanRef.current = Date.now();
      setLastScan(new Date().toISOString());

    } catch (error) {
      console.error('❌ Vaibey scan error:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // ── Get context for Vaibey ──
  const getContextForVaibey = useCallback(() => {
    if (!userData || !userData.notes) {
      return {
        notes: [],
        messages: [],
        quizHistory: [],
        studyTopics: [],
        recentActivity: []
      };
    }

    return {
      notes: userData.notes.map(n => ({
        title: n.title || 'Untitled',
        content: n.content || '',
        subject: n.subject || 'General',
        date: n.created_at
      })),
      messages: userData.messages?.slice(0, 20).map(m => m.content) || [],
      quizHistory: userData.quizHistory?.slice(0, 20).map(q => ({
        question: q.question,
        isCorrect: q.is_correct,
        topic: q.topic
      })) || [],
      studyTopics: userData.studyTopics || [],
      recentActivity: userData.recentActivity || []
    };
  }, [userData]);

  // ── Find related content for a query ──
  const findRelatedContent = useCallback((query) => {
    const results = [];
    const searchTerms = query.toLowerCase().split(' ');

    // Search notes
    userData.notes?.forEach(note => {
      const content = (note.title + ' ' + note.content).toLowerCase();
      const matches = searchTerms.filter(term => content.includes(term));
      if (matches.length > 0) {
        results.push({
          type: 'note',
          title: note.title,
          content: note.content,
          subject: note.subject,
          relevance: matches.length / searchTerms.length,
          date: note.created_at
        });
      }
    });

    // Search quiz history
    userData.quizHistory?.forEach(quiz => {
      const question = quiz.question?.toLowerCase() || '';
      const matches = searchTerms.filter(term => question.includes(term));
      if (matches.length > 0) {
        results.push({
          type: 'quiz',
          question: quiz.question,
          isCorrect: quiz.is_correct,
          topic: quiz.topic,
          relevance: matches.length / searchTerms.length
        });
      }
    });

    // Sort by relevance
    results.sort((a, b) => b.relevance - a.relevance);
    return results.slice(0, 5);
  }, [userData]);

  // ── Auto-scan on user change ──
  useEffect(() => {
    if (user) {
      scanUserData();
    } else {
      setUserData({
        notes: [],
        messages: [],
        quizHistory: [],
        studyTopics: [],
        recentActivity: []
      });
      lastScanRef.current = null; // ✅ Reset cache on logout
    }
  }, [user, scanUserData]);

  const value = {
    userData,
    loading,
    lastScan,
    scanUserData,
    getContextForVaibey,
    findRelatedContent
  };

  return (
    <VaibeyContext.Provider value={value}>
      {children}
    </VaibeyContext.Provider>
  );
};