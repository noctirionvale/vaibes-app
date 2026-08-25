import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import './VidFeed.css';

/* ── Feed cache: survives tab switches & reloads within a session ── */
const CACHE_KEY = 'vaibes_vidfeed_cache_v1';
const CACHE_TTL = 2 * 60 * 60 * 1000;

const readCache = () => {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!cached || !Array.isArray(cached.items) || !cached.channelKey) return null;
    if (Date.now() - (cached.savedAt || 0) > CACHE_TTL) return null;
    return cached;
  } catch { return null; }
};

const writeCache = (payload) => {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload)); } catch { /* blocked */ }
};

/* ── YouTube IFrame Player API loader (official, ToS-compliant) ── */
let ytApiPromise = null;
const loadYTApi = () => {
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    if (window.YT && window.YT.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
  return ytApiPromise;
};

const VidFeed = ({ onCountChange, compact = false }) => {
  const { user } = useAuth();

  const [channels, setChannels] = useState([]);
  const [channelsLoading, setChannelsLoading] = useState(true);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  const [showManage, setShowManage] = useState(false);
  const [savedView, setSavedView] = useState(false);
  const [channelInput, setChannelInput] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState('');
  const [candidates, setCandidates] = useState([]);

  const [savedIds, setSavedIds] = useState(new Set());
  const [savedList, setSavedList] = useState([]);

  const scrollRef = useRef(null);
  const restoreIndexRef = useRef(0);
  const pendingJumpRef = useRef(null);

  const playerRef = useRef(null);
  const pollRef = useRef(null);
  const progressRef = useRef({});
  const itemsRef = useRef(items);
  const activeIndexRef = useRef(activeSlideIndex);
  const channelKeyRef = useRef('');
  const savedViewRef = useRef(savedView);

  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { activeIndexRef.current = activeSlideIndex; }, [activeSlideIndex]);
  useEffect(() => { savedViewRef.current = savedView; }, [savedView]);

  const channelIdsKey = channels.map(c => c.channel_id).sort().join(',');
  useEffect(() => { channelKeyRef.current = channelIdsKey; }, [channelIdsKey]);

  const persistNow = useCallback(() => {
    if (savedViewRef.current) return;
    writeCache({
      channelKey: channelKeyRef.current,
      items: itemsRef.current,
      activeIndex: activeIndexRef.current,
      progress: progressRef.current,
      savedAt: Date.now(),
    });
  }, []);

  useEffect(() => () => persistNow(), [persistNow]);

  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  /* ── Channels ── */
  const loadChannels = useCallback(async () => {
    if (!user) { setChannels([]); setChannelsLoading(false); return; }
    setChannelsLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_video_channels')
        .select('id, channel_id, channel_title, channel_thumbnail')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setChannels(data || []);
    } catch (err) {
      console.error('❌ Load channels error:', err);
    } finally {
      setChannelsLoading(false);
    }
  }, [user]);

  useEffect(() => { loadChannels(); }, [loadChannels]);

  /* ── Saved videos ── */
  const loadSaved = useCallback(async () => {
    if (!user) { setSavedIds(new Set()); setSavedList([]); return; }
    const { data } = await supabase
      .from('user_saved_videos')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setSavedList(data || []);
    setSavedIds(new Set((data || []).map(v => v.video_id)));
  }, [user]);

  useEffect(() => { loadSaved(); }, [loadSaved]);

  // Memoized so the player effect doesn't restart on unrelated renders
  const savedItems = useMemo(() => savedList.map(v => ({
    id: v.video_id,
    title: v.title,
    channelTitle: v.channel_title,
    thumbnail: v.thumbnail,
    publishedAt: v.published_at,
  })), [savedList]);

  const slides = savedView ? savedItems : items;

  const toggleSave = async (video) => {
    if (!user) return;
    const isSaved = savedIds.has(video.id);
    setSavedIds(prev => {
      const n = new Set(prev);
      isSaved ? n.delete(video.id) : n.add(video.id);
      return n;
    });
    try {
      if (isSaved) {
        await supabase.from('user_saved_videos')
          .delete().eq('user_id', user.id).eq('video_id', video.id);
      } else {
        await supabase.from('user_saved_videos').upsert({
          user_id: user.id,
          video_id: video.id,
          title: video.title,
          channel_title: video.channelTitle,
          thumbnail: video.thumbnail,
          published_at: video.publishedAt || null,
        }, { onConflict: 'user_id,video_id' });
      }
      loadSaved();
    } catch (err) {
      console.error('❌ Save video error:', err);
      loadSaved();
    }
  };

  /* ── Channels add/remove ── */
  const saveChannel = async (channel) => {
    try {
      const { error } = await supabase.from('user_video_channels').upsert({
        user_id: user.id,
        channel_id: channel.id,
        channel_title: channel.title,
        channel_thumbnail: channel.thumbnail,
      }, { onConflict: 'user_id,channel_id', ignoreDuplicates: true });
      if (error) throw error;
      await loadChannels();
      setCandidates([]);
      setChannelInput('');
    } catch (err) {
      console.error('❌ Save channel error:', err);
      setResolveError('Could not save that channel — try again.');
    }
  };

  const handleAddChannel = async () => {
    const query = channelInput.trim();
    if (!query || !user || resolving) return;
    setResolving(true);
    setResolveError('');
    setCandidates([]);

    // Hard 15s cap so "Add" can never hang forever on a cold/slow API
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch('/api/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve', query }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resolve channel');

      if (!data.channels || data.channels.length === 0) {
        setResolveError(data.message || 'No matching channel found.');
      } else if (data.channels.length === 1) {
        await saveChannel(data.channels[0]);
      } else {
        setCandidates(data.channels);
      }
    } catch (err) {
      console.error('❌ Resolve channel error:', err);
      setResolveError(
        err.name === 'AbortError'
          ? 'Taking too long — check your connection and try again.'
          : (err.message || 'Something went wrong — try again.')
      );
    } finally {
      clearTimeout(timer);
      setResolving(false);
    }
  };

  const handleRemoveChannel = async (channelId) => {
    if (!user) return;
    setChannels(prev => prev.filter(c => c.channel_id !== channelId));
    try {
      await supabase.from('user_video_channels').delete().eq('user_id', user.id).eq('channel_id', channelId);
    } catch (err) {
      console.error('❌ Remove channel error:', err);
      loadChannels();
    }
  };

  /* ── Feed fetch ── */
  const fetchFeed = useCallback(async (isRefresh = false) => {
    if (channels.length === 0) { setItems([]); return; }
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelIds: channels.map(c => c.channel_id), refresh: isRefresh }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load video feed');

      const shuffled = shuffleArray(data.videos || []);
      progressRef.current = {};
      setItems(shuffled);
      setActiveSlideIndex(0);
      writeCache({
        channelKey: channels.map(c => c.channel_id).sort().join(','),
        items: shuffled,
        activeIndex: 0,
        progress: {},
        savedAt: Date.now(),
      });

      if (isRefresh && scrollRef.current) {
        scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      setError(err.message || 'Failed to load videos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [channels]);

  /* ── Restore feed from cache or fetch ── */
  useEffect(() => {
    if (channelsLoading) return;
    const cached = readCache();
    if (cached && cached.channelKey === channelIdsKey && cached.items.length > 0) {
      progressRef.current = cached.progress || {};
      restoreIndexRef.current = Math.max(0, cached.activeIndex || 0);
      setItems(cached.items);
    } else {
      fetchFeed(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelsLoading, channelIdsKey]);

  useEffect(() => {
    if (onCountChange) onCountChange(items.length);
  }, [items.length, onCountChange]);

  const scrollToIndex = useCallback((idx) => {
    const container = scrollRef.current;
    if (!container) return;
    const prev = container.style.scrollBehavior;
    container.style.scrollBehavior = 'auto';
    container.scrollTop = idx * container.clientHeight;
    container.style.scrollBehavior = prev;
    setActiveSlideIndex(idx);
  }, []);

  /* ── Jump back to cached slide after feed restore ── */
  useEffect(() => {
    if (savedView) return;
    const idx = restoreIndexRef.current;
    if (!idx || items.length === 0) return;
    restoreIndexRef.current = 0;
    requestAnimationFrame(() => scrollToIndex(Math.min(idx, items.length - 1)));
  }, [items, savedView, scrollToIndex]);

  /* ── Reposition whenever the scroll container remounts:
       closing the manage panel, or switching Feed ↔ Saved.
       (This is what fixes "video goes blank after adding a channel".) ── */
  useEffect(() => {
    if (showManage) return;
    requestAnimationFrame(() => {
      const pending = pendingJumpRef.current;
      pendingJumpRef.current = null;
      if (savedView) {
        const idx = pending ?? 0;
        if (savedItems.length) scrollToIndex(Math.min(idx, savedItems.length - 1));
      } else if (itemsRef.current.length) {
        const idx = pending ?? Math.min(activeIndexRef.current, itemsRef.current.length - 1);
        scrollToIndex(idx);
      }
    });
  }, [showManage, savedView, scrollToIndex, savedItems]);

  /* ── Remember position as you swipe (feed only) ── */
  useEffect(() => { persistNow(); }, [activeSlideIndex, persistNow]);

  /* ── Active-slide observer (re-attaches when panel closes) ── */
  useEffect(() => {
    if (slides.length === 0 || showManage) return;
    const container = scrollRef.current;
    if (!container) return;

    const slideEls = container.querySelectorAll('.vidfeed-slide');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            setActiveSlideIndex(Number(entry.target.dataset.index));
          }
        });
      },
      { root: container, threshold: [0.6] }
    );

    slideEls.forEach((slide) => observer.observe(slide));
    return () => observer.disconnect();
  }, [slides, showManage]);

  /* ── YouTube IFrame player per active slide (re-creates when panel closes) ── */
  useEffect(() => {
    let cancelled = false;
    const video = showManage ? null : slides[activeSlideIndex];

    const teardown = () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      if (playerRef.current) {
        try {
          const vid = playerRef.current.getVideoData?.()?.video_id;
          const t = playerRef.current.getCurrentTime?.();
          if (vid && Number.isFinite(t)) progressRef.current[vid] = t;
          playerRef.current.destroy();
        } catch { /* DOM already gone */ }
        playerRef.current = null;
      }
      persistNow();
    };

    teardown();
    if (!video) return;

    loadYTApi().then((YT) => {
      if (cancelled) return;
      const wrapper = scrollRef.current?.querySelector(`[data-host="${video.id}"]`);
      if (!wrapper) return;

      const el = document.createElement('div');
      wrapper.appendChild(el);

      playerRef.current = new YT.Player(el, {
        width: '100%',
        height: '100%',
        videoId: video.id,
        playerVars: { autoplay: 1, controls: 1, rel: 0, playsinline: 1 },
        events: {
          onReady: (e) => {
            const saved = progressRef.current[video.id];
            if (saved && saved > 5) {
              try { e.target.seekTo(saved, true); } catch { /* not cued yet */ }
            }
            pollRef.current = setInterval(() => {
              try {
                const t = playerRef.current?.getCurrentTime?.();
                if (Number.isFinite(t)) progressRef.current[video.id] = t;
              } catch { /* mid-teardown */ }
            }, 1000);
          },
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) {
              try { progressRef.current[video.id] = e.target.getCurrentTime(); persistNow(); } catch { /* noop */ }
            }
          },
        },
      });
    });

    return () => { cancelled = true; teardown(); };
  }, [activeSlideIndex, slides, showManage, persistNow]);

  const handleRefresh = () => {
    restoreIndexRef.current = 0;
    fetchFeed(true);
  };

  /* ── From the manage panel: play a saved video in-app ── */
  const jumpToSaved = (v) => {
    setShowManage(false);
    const feedIdx = items.findIndex(i => i.id === v.video_id);
    if (feedIdx >= 0 && !savedView) {
      pendingJumpRef.current = feedIdx;
      setSavedView(false);
    } else {
      pendingJumpRef.current = Math.max(savedItems.findIndex(s => s.id === v.video_id), 0);
      setSavedView(true);
    }
  };

  const currentVideo = slides[activeSlideIndex] || null;

  /* ── Slides renderer (shared by Feed and Saved) ── */
  const renderSlides = (list) => (
    <div className="vidfeed-scroll" ref={scrollRef}>
      {list.map((video, idx) => (
        <div key={`${video.id}-${idx}`} className="vidfeed-slide" data-index={idx}>
          <div className="vidfeed-slide-player">
            <div
              className="vidfeed-slide-bg"
              style={video.thumbnail ? { backgroundImage: `url(${video.thumbnail})` } : undefined}
              aria-hidden="true"
            />
            {activeSlideIndex === idx ? (
              <div className="vidfeed-iframe-host" data-host={video.id} />
            ) : (
              <img src={video.thumbnail} alt={video.title} className="vidfeed-thumb-fallback" loading="lazy" />
            )}
          </div>

          {activeSlideIndex !== idx && (
            <button
              className={`vf-save-btn slide-save ${savedIds.has(video.id) ? 'saved' : ''}`}
              onClick={() => toggleSave(video)}
            >
              {savedIds.has(video.id) ? '★' : '☆'}
            </button>
          )}

          {activeSlideIndex !== idx && (
            <div className="vidfeed-slide-overlay">
              <div className="vidfeed-slide-title">{video.title}</div>
              <div className="vidfeed-slide-meta">
                {video.channelTitle}{video.publishedAt ? ` · ${new Date(video.publishedAt).toLocaleDateString()}` : ''}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  /* ── Manage panel ── */
  const renderManagePanel = () => (
    <div className="vf-manage-panel">
      <div className="vf-channel-input-row">
        <input
          type="text"
          className="vf-channel-input"
          placeholder="Paste a channel URL, @handle, or name…"
          value={channelInput}
          onChange={e => setChannelInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAddChannel(); }}
          disabled={resolving}
        />
        <button className="vf-add-btn" onClick={handleAddChannel} disabled={resolving || !channelInput.trim()}>
          {resolving ? '…' : 'Add'}
        </button>
      </div>

      {resolveError && <div className="vf-resolve-error">{resolveError}</div>}

      {candidates.length > 0 && (
        <div className="vf-candidates-list">
          <p className="vf-candidates-label">Which one did you mean?</p>
          {candidates.map(c => (
            <button key={c.id} className="vf-candidate-item" onClick={() => saveChannel(c)}>
              {c.thumbnail
                ? <img src={c.thumbnail} alt="" className="vf-candidate-thumb" />
                : <span className="vf-candidate-thumb-fallback">▶</span>}
              <span className="vf-candidate-title">{c.title}</span>
            </button>
          ))}
        </div>
      )}

      <div className="vf-channel-chip-list">
        {channelsLoading ? (
          <p className="vf-channel-list-empty">Loading your channels…</p>
        ) : channels.length === 0 ? (
          <p className="vf-channel-list-empty">No channels added yet — paste one above to get started.</p>
        ) : (
          channels.map(c => (
            <div key={c.channel_id} className="vf-channel-chip">
              {c.channel_thumbnail
                ? <img src={c.channel_thumbnail} alt="" className="vf-channel-chip-thumb" />
                : <span className="vf-channel-chip-thumb-fallback">▶</span>}
              <span className="vf-channel-chip-title">{c.channel_title || c.channel_id}</span>
              <button className="vf-channel-chip-remove" onClick={() => handleRemoveChannel(c.channel_id)} title="Remove">✕</button>
            </div>
          ))
        )}
      </div>

      {savedList.length > 0 && (
        <div className="vf-channel-chip-list">
          <p className="vf-candidates-label">★ Saved videos</p>
          {savedList.map(v => (
            <div key={v.video_id} className="vf-saved-row">
              <button className="vf-candidate-item" onClick={() => jumpToSaved(v)}>
                {v.thumbnail
                  ? <img src={v.thumbnail} alt="" className="vf-candidate-thumb" />
                  : <span className="vf-candidate-thumb-fallback">▶</span>}
                <span className="vf-candidate-title">{v.title}</span>
              </button>
              <button className="vf-channel-chip-remove" onClick={() => toggleSave({ id: v.video_id })} title="Remove">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className={`vidfeed-wrapper ${compact ? 'vidfeed-compact' : ''}`}>
      <div className="vidfeed-header">
        <div className="vf-header-actions">
          <button className="vf-manage-toggle-btn" onClick={() => setShowManage(s => !s)}>
            {showManage ? '✕ Close' : `⚙️ Channels${channels.length ? ` (${channels.length})` : ''}`}
          </button>

          <button
            className={`vf-manage-toggle-btn vf-saved-toggle ${savedView ? 'active' : ''}`}
            onClick={() => { setShowManage(false); setSavedView(v => !v); }}
          >
            ★ Saved{savedList.length ? ` (${savedList.length})` : ''}
          </button>

          {!showManage && !savedView && currentVideo && (
            <button
              className={`vf-save-btn ${savedIds.has(currentVideo.id) ? 'saved' : ''}`}
              onClick={() => toggleSave(currentVideo)}
              title={savedIds.has(currentVideo.id) ? 'Remove from saved' : 'Save video'}
            >
              {savedIds.has(currentVideo.id) ? '★ Saved' : '☆ Save'}
            </button>
          )}

          {!showManage && !savedView && (
            <button
              className={`vidfeed-refresh-btn ${refreshing ? 'spinning' : ''}`}
              onClick={handleRefresh}
              disabled={refreshing || channels.length === 0}
              title="Refresh feed"
            >
              ↻ {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          )}
        </div>
      </div>

      {showManage ? (
        renderManagePanel()
      ) : savedView ? (
        savedItems.length === 0 ? (
          <div className="vidfeed-status">
            <span>★</span>
            <p>No saved videos yet. Tap ☆ on any video and it'll wait for you here.</p>
            <button className="vidfeed-retry-btn" onClick={() => setSavedView(false)}>Back to Feed</button>
          </div>
        ) : (
          renderSlides(savedItems)
        )
      ) : channelsLoading ? (
        <div className="vidfeed-status"><span>⏳</span><p>Loading your channels...</p></div>
      ) : channels.length === 0 ? (
        <div className="vidfeed-status vf-onboarding">
          <span>📺</span>
          <p>Your VidFeed is empty. Add a channel to start building your own feed — no defaults, no suggestions, just what you choose.</p>
          <button className="vidfeed-retry-btn" onClick={() => setShowManage(true)}>Add a Channel</button>
        </div>
      ) : loading ? (
        <div className="vidfeed-status"><span>⏳</span><p>Loading videos...</p></div>
      ) : error ? (
        <div className="vidfeed-status">
          <span>⚠️</span>
          <p>{error}</p>
          <button className="vidfeed-retry-btn" onClick={() => fetchFeed(false)}>Retry</button>
        </div>
      ) : items.length === 0 ? (
        <div className="vidfeed-status"><span>📭</span><p>No videos found for your channels yet.</p></div>
      ) : (
        renderSlides(items)
      )}
    </div>
  );
};

export default VidFeed;