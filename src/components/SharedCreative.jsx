import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import './SharedCreative.css';

const MOODS = [
  { key: 'inspired',  label: '🔥 Inspired' },
  { key: 'studying',  label: '🧠 Studying' },
  { key: 'thinking',  label: '💭 Thinking' },
  { key: 'latenight', label: '🌙 Late night' },
  { key: 'flow',      label: '⚡ Flow state' },
];

const TEASER_CHAR_LIMIT = 200;

// ✅ FIX: Hoisted pure utilities outside component to prevent re-creation on every render
const getFingerprint = () => {
  const stored = localStorage.getItem('vaibes_fingerprint');
  if (stored) return stored;
  const fp = 'fp_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
  localStorage.setItem('vaibes_fingerprint', fp);
  return fp;
};

const extractYouTubeId = (url) => {
  if (!url) return null;
  const m = url.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
  return m && m[2]?.length === 11 ? m[2] : null;
};

const stripHtml = (html) => {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').trim();
};

const truncateAtWord = (text, limit) => {
  if (!text || text.length <= limit) return text || '';
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + '…';
};

const SharedCreative = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [shared, setShared] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveCount, setSaveCount] = useState(0);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinRequestSent, setJoinRequestSent] = useState(false);

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
    const fetch = async () => {
      const { data, error } = await supabase.from('user_creatives').select('*')
        .eq('id', id).eq('is_public', true).maybeSingle();
      if (error || !data) { 
        setError('This content is not available or has been removed.'); 
        setLoading(false); 
        return; 
      }
      setItem(data); 

      if (user) {
        const { data: savedData } = await supabase.from('user_saves').select('id')
          .eq('user_id', user.id).eq('content_type', 'wall').eq('item_id', id).maybeSingle();
        if (savedData) setSaved(true);
      } else {
        const fingerprint = getFingerprint();
        const { data: savedData } = await supabase.from('pending_saves').select('id')
          .eq('fingerprint', fingerprint).eq('content_type', 'wall').eq('item_id', id).maybeSingle();
        if (savedData) setSaved(true);
      }

      const [{ count: pendingCount }, { count: claimedCount }] = await Promise.all([
        supabase.from('pending_saves').select('*', { count: 'exact', head: true }).eq('content_type', 'wall').eq('item_id', id),
        supabase.from('user_saves').select('*', { count: 'exact', head: true }).eq('content_type', 'wall').eq('item_id', id),
      ]);
      setSaveCount((pendingCount || 0) + (claimedCount || 0));
      setLoading(false);
    };
    fetch();
  }, [id, user]);

  useEffect(() => {
    if (user) {
      const claim = async () => {
        const { error: claimError } = await supabase.rpc('claim_pending_saves_as_spectator', { fp: getFingerprint() });
        if (claimError) console.error('Immediate claim failed:', claimError);
      };
      claim();
    }
  }, [user]);

  const handleSave = async () => {
    if (!item) return;

    if (saved) {
      if (user) {
        await supabase.from('user_saves').delete().eq('user_id', user.id).eq('content_type', 'wall').eq('item_id', item.id);
      } else {
        await supabase.from('pending_saves').delete().eq('fingerprint', getFingerprint()).eq('content_type', 'wall').eq('item_id', item.id);
      }
      setSaved(false);
      setSaveCount(prev => Math.max(0, prev - 1));
      return;
    }

    const { error } = user
      ? await supabase.from('user_saves').insert({ user_id: user.id, content_type: 'wall', item_id: item.id })
      : await supabase.from('pending_saves').insert({ fingerprint: getFingerprint(), content_type: 'wall', item_id: item.id });

    if (error && error.code !== '23505') return;
    setSaved(true);
    setSaveCount(prev => prev + 1);
  };

  const handleJoinRequest = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    if (item.wall_item_id) {
      const { data: group } = await supabase
        .from('groups')
        .select('id')
        .eq('wall_item_id', item.id)
        .maybeSingle();
      
      if (!group) {
        alert('This item is not linked to a study room');
        return;
      }
      
      const { error } = await supabase
        .from('join_requests')
        .insert({
          group_id: group.id,
          item_id: item.id,
          requester_email: formData.get('email'),
          requester_name: formData.get('name'),
          message: formData.get('message') || null
        });
      
      if (!error) {
        setJoinRequestSent(true);
        setTimeout(() => setShowJoinModal(false), 2000);
      } else {
        alert('Failed to send request: ' + error.message);
      }
    }
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    const plain = stripHtml(item.content) || item.title || '';
    const teaser = plain.length > 120 ? plain.slice(0, 120).trim() + '…' : plain;
    const shareText = `📖 ${item.title} — Read it on vAIbes →\n\n${teaser}`;

    if (navigator.share) {
      try { await navigator.share({ title: item.title, text: shareText, url: shareUrl }); return; }
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

  const ytId = extractYouTubeId(item.content);
  const mood = MOODS.find(m => m.key === item.mood);
  const videoAtts = item.attachments?.filter(a => a.type?.startsWith('video/')) || [];
  const imageAtts = item.attachments?.filter(a => a.type?.startsWith('image/')) || [];
  const fileAtts = item.attachments?.filter(a =>
    !a.type?.startsWith('image/') && !a.type?.startsWith('video/')) || [];

  const isLocked = !user;
  const plainText = stripHtml(item.content);
  const teaserText = truncateAtWord(plainText, TEASER_CHAR_LIMIT);
  const visibleImages = isLocked ? imageAtts.slice(0, 1) : imageAtts;
  const hiddenAttachmentCount = isLocked
    ? Math.max(imageAtts.length - 1, 0) + videoAtts.length + fileAtts.length
    : 0;

  return (
    <div className="shared-page">
      <div className="shared-container">
        <div className="shared-header">
          <Link to="/" className="shared-brand">vAIbes</Link>
          <div className="shared-badges">
            {mood && <span className="shared-mood">{mood.label}</span>}
          </div>
        </div>

        <h1 className="shared-title">{item.title}</h1>
        <p className="shared-meta">Shared from vAIbes Creative Workspace</p>

        {ytId && (
          <div className="shared-video-wrap">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${ytId}`}
              title={item.title} frameBorder="0" allowFullScreen
            />
          </div>
        )}

        {!isLocked && videoAtts.map((v, i) => (
          <div key={i} className="shared-video-wrap">
            <video src={v.url} controls style={{ width: '100%', borderRadius: '12px' }} />
          </div>
        ))}

        {visibleImages.length > 0 && (
          <div className="shared-images">
            {visibleImages.map((img, i) => (
              <img key={i} src={img.url} alt={img.name} className="shared-image" />
            ))}
          </div>
        )}

        {item.content && (
          isLocked ? (
            <p className="shared-body shared-teaser-text">{teaserText || 'Sign in to read this piece.'}</p>
          ) : (
            <div className="shared-body" dangerouslySetInnerHTML={{ __html: item.content }} />
          )
        )}

        {isLocked && (
          <div className="shared-gate">
            <div className="shared-gate-content">
              <p className="shared-gate-title">Keep reading on vAIbes</p>
              <p className="shared-gate-subtitle">
                {hiddenAttachmentCount > 0
                  ? `Sign up free to finish "${item.title}" — plus ${hiddenAttachmentCount} more attachment${hiddenAttachmentCount === 1 ? '' : 's'}.`
                  : plainText.length > TEASER_CHAR_LIMIT
                  ? `Sign up free to finish "${item.title}" — save it, discuss it in the Study Room, and explore more.`
                  : `Sign up free to save "${item.title}", discuss it in the Study Room, and explore more.`}
              </p>
              <Link to="/" className="shared-gate-cta">Sign Up Free →</Link>
              <p className="shared-gate-note">Takes about 30 seconds. No credit card required.</p>
            </div>
          </div>
        )}

        {!isLocked && fileAtts.length > 0 && (
          <div className="shared-files">
            <h3>📎 Attachments</h3>
            {fileAtts.map((f, i) => (
              <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" className="shared-file-link">
                📎 {f.name}
              </a>
            ))}
          </div>
        )}

        <div className="shared-actions">
          <button 
            className={`shared-share-btn ${saved ? 'saved' : ''}`} 
            onClick={handleSave}
            title="Save to your wall (read-only)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            {saved ? 'Saved' : 'Save'} ({saveCount})
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

          {item.wall_item_id && !joinRequestSent && (
            <button className="shared-cta" onClick={() => setShowJoinModal(true)}>
              Request to Join Room
            </button>
          )}

          {joinRequestSent && (
            <span className="shared-request-sent">
              ✓ Request sent!
            </span>
          )}
        </div>

        {showJoinModal && (
          <div className="shared-modal-overlay" onClick={() => setShowJoinModal(false)}>
            <div className="shared-modal" onClick={e => e.stopPropagation()}>
              <button className="shared-modal-close" onClick={() => setShowJoinModal(false)}>✕</button>
              <h3>Request to Join Study Room</h3>
              <p className="shared-modal-sub">
                The room owner will review your request. Once approved, you'll be able to chat and interact.
              </p>
              <form onSubmit={handleJoinRequest}>
                <input type="text" name="name" placeholder="Your name" required className="shared-modal-input" />
                <input type="email" name="email" placeholder="Your email" required className="shared-modal-input" />
                <textarea name="message" placeholder="Why do you want to join? (optional)" rows="3" className="shared-modal-input" />
                <button type="submit" className="shared-modal-submit">Send Request</button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SharedCreative;