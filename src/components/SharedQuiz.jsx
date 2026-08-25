import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import './SharedCreative.css';

const TEASER_CHAR_LIMIT = 200;

const stripHtml = (html) => {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
};

const truncateAtWord = (text, limit) => {
  if (!text || text.length <= limit) return text || '';
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + '…';
};

const getFingerprint = () => {
  const stored = localStorage.getItem('vaibes_fingerprint');
  if (stored) return stored;
  const fp = 'fp_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
  localStorage.setItem('vaibes_fingerprint', fp);
  return fp;
};

const TYPE_META = {
  quiz:         { icon: '🧠', label: 'Quiz' },
  subject_quiz: { icon: '📚', label: 'Subject Quiz' },
  flashcard:    { icon: '🃏', label: 'Flashcard' },
  community:    { icon: '🏆', label: 'Community' },
};

const SharedQuiz = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [shared, setShared] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveCount, setSaveCount] = useState(0);

  // ✅ FIX: Scroll lock/unlock for shared routes
  useEffect(() => {
    document.documentElement.classList.add('shared-route');
    document.body.classList.add('shared-route');
    return () => {
      document.documentElement.classList.remove('shared-route');
      document.body.classList.remove('shared-route');
    };
  }, []);

  useEffect(() => {
    const fetchPost = async () => {
      const { data, error } = await supabase
        .from('edufeed_posts')
        .select('*, profiles(display_name, username, avatar_url)')
        .eq('id', id).eq('is_published', true).maybeSingle();
      
      if (error || !data) {
        setError('This quiz is not available or has been removed.');
        setLoading(false);
        return;
      }
      
      setPost(data);

      if (user) {
        const { data: savedData } = await supabase.from('user_saves').select('id')
          .eq('user_id', user.id).eq('content_type', 'quiz').eq('item_id', id).maybeSingle();
        if (savedData) setSaved(true);
      } else {
        const { data: savedData } = await supabase.from('pending_saves').select('id')
          .eq('fingerprint', getFingerprint()).eq('content_type', 'quiz').eq('item_id', id).maybeSingle();
        if (savedData) setSaved(true);
      }

      const [{ count: pendingCount }, { count: claimedCount }] = await Promise.all([
        supabase.from('pending_saves').select('*', { count: 'exact', head: true }).eq('content_type', 'quiz').eq('item_id', id),
        supabase.from('user_saves').select('*', { count: 'exact', head: true }).eq('content_type', 'quiz').eq('item_id', id),
      ]);
      setSaveCount((pendingCount || 0) + (claimedCount || 0));

      setLoading(false);
    };
    fetchPost();
  }, [id, user]);

  const handleSave = async () => {
    if (!post) return;

    if (saved) {
      if (user) {
        await supabase.from('user_saves').delete().eq('user_id', user.id).eq('content_type', 'quiz').eq('item_id', post.id);
      } else {
        await supabase.from('pending_saves').delete().eq('fingerprint', getFingerprint()).eq('content_type', 'quiz').eq('item_id', post.id);
      }
      setSaved(false);
      setSaveCount(prev => Math.max(0, prev - 1));
      return;
    }

    const { error } = user
      ? await supabase.from('user_saves').insert({ user_id: user.id, content_type: 'quiz', item_id: post.id })
      : await supabase.from('pending_saves').insert({ fingerprint: getFingerprint(), content_type: 'quiz', item_id: post.id });

    if (error && error.code !== '23505') return;
    setSaved(true);
    setSaveCount(prev => prev + 1);
  };

  const handleShare = async () => {
    if (!post) return;
    const shareUrl = window.location.href;
    const meta = TYPE_META[post.type] || TYPE_META.quiz;
    const shareText = `${meta.icon} ${post.title}\n\nPlay it on vAIbes →`;
    
    if (navigator.share) {
      try { await navigator.share({ title: post.title, text: shareText, url: shareUrl }); return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }
    try {
      await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
      setShared(true); setTimeout(() => setShared(false), 2000);
    } catch (err) {
      console.error('❌ share failed:', err);
      alert(`Share this link:\n${shareText}\n\n${shareUrl}`);
    }
  };

  if (loading) return (
    <div className="shared-loading">
      <div className="shared-spinner" />
      <span>Loading...</span>
    </div>
  );

  if (error) return (
    <div className="shared-error-page">
      <div className="shared-error-icon">🔒</div>
      <h2>{error}</h2>
      <Link to="/app" className="shared-cta">Go to vAIbes →</Link>
    </div>
  );

  const quiz = post.quiz_data || {};
  const meta = TYPE_META[post.type] || TYPE_META.quiz;
  const isCommunity = post.type === 'community' || post.community_data?.is_community;
  const questionText = isCommunity
    ? post.title
    : (quiz.question || quiz.questions?.[0]?.question || post.title || '');
  const teaserText = truncateAtWord(stripHtml(questionText), TEASER_CHAR_LIMIT);
  const imageAtt = post.attachments?.find(a => a.type?.startsWith('image/'));
  const questionCount = quiz.questions?.length;
  const isLocked = !user;

  return (
    <div className="shared-page">
      <div className="shared-container">
        <div className="shared-header">
          <Link to="/" className="shared-brand">vAIbes</Link>
          <div className="shared-badges">
            <span className="shared-quiz-type-badge">{meta.icon} {meta.label}</span>
          </div>
        </div>

        <h1 className="shared-title">{post.title}</h1>
        <p className="shared-meta">
          {post.subject ? `${post.subject} · ` : ''}Shared from vAIbes EduFeed
          {post.profiles?.display_name ? ` · by ${post.profiles.display_name}` : ''}
        </p>

        {imageAtt && (
          <div className="shared-images">
            <img src={imageAtt.url} alt="" className="shared-image" />
          </div>
        )}

        <p className="shared-body shared-teaser-text">
          {teaserText || 'Sign in to see this question.'}
        </p>

        <div className="shared-quiz-stats">
          {questionCount ? <span>📋 {questionCount} question{questionCount > 1 ? 's' : ''}</span> : null}
          {post.likes_count ? <span>❤️ {post.likes_count}</span> : null}
          {post.comment_count ? <span>💬 {post.comment_count}</span> : null}
        </div>

        <div className="shared-gate">
          <div className="shared-gate-content">
            <p className="shared-gate-title">
              {isLocked ? 'Sign up to answer this quiz' : 'Play this quiz in the app'}
            </p>
            <p className="shared-gate-subtitle">
              {isLocked
                ? `Create a free vAIbes account to answer "${post.title}" and see how you score.`
                : `Head to your EduFeed to play "${post.title}" and earn points.`}
            </p>
            <Link to={isLocked ? '/' : '/app'} className="shared-gate-cta">
              {isLocked ? 'Sign Up Free →' : 'Open in vAIbes →'}
            </Link>
            {isLocked && <p className="shared-gate-note">Takes about 30 seconds. No credit card required.</p>}
          </div>
        </div>

        <div className="shared-actions">
          <button 
            className={`shared-share-btn ${saved ? 'saved' : ''}`} 
            onClick={handleSave}
            title="Save to your wall"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            {saved ? '✓ Saved' : 'Save'} ({saveCount})
          </button>

          <button className="shared-share-btn" onClick={handleShare}>
            {shared ? '✓ Copied!' : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
                Share
              </>
            )}
          </button>
          <Link to="/app" className="shared-cta">✨ Explore vAIbes</Link>
        </div>
      </div>
    </div>
  );
};

export default SharedQuiz;