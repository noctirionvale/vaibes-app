import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const YOUTUBE_CHANNELS = [
  { id: 'UCsFG39ve0KyCDXUoUDGGhog', label: 'vAIbes' }, // ← replace with real ID
];

const parseYouTubeRSS = async (channelId) => {
  try {
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(rssUrl)}`;
    const res = await fetch(proxyUrl);
    const json = await res.json();
    const parser = new DOMParser();
    const xml = parser.parseFromString(json.contents, 'text/xml');
    const entries = xml.querySelectorAll('entry');
    return Array.from(entries).slice(0, 8).map(entry => {
      const videoId = entry.querySelector('videoId')?.textContent;
      const title = entry.querySelector('title')?.textContent;
      const published = entry.querySelector('published')?.textContent;
      const views = entry.querySelector('statistics')?.getAttribute('views');
      return {
        videoId,
        title,
        published: published ? new Date(published).toLocaleDateString() : '',
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        thumbnailFallback: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        views: views ? parseInt(views).toLocaleString() : null
      };
    });
  } catch {
    return [];
  }
};

const ContentFeed = () => {
  const [cards, setCards] = useState([]);
  const [videos, setVideos] = useState([]);
  const [activeCard, setActiveCard] = useState(0);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [hoveredVideo, setHoveredVideo] = useState(null);
  const [playingVideo, setPlayingVideo] = useState(null);
  const autoRotateRef = useRef(null);
  const touchStartX = useRef(null);

  useEffect(() => {
    const fetchCards = async () => {
      const { data } = await supabase
        .from('content_cards')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (data) setCards(data);
    };
    fetchCards();
  }, []);

  useEffect(() => {
    const fetchVideos = async () => {
      setLoadingVideos(true);
      const results = await parseYouTubeRSS(YOUTUBE_CHANNELS[0].id);
      setVideos(results);
      setLoadingVideos(false);
    };
    fetchVideos();
  }, []);

  useEffect(() => {
    if (cards.length === 0) return;
    autoRotateRef.current = setInterval(() => {
      setActiveCard(prev => (prev + 1) % cards.length);
    }, 4000);
    return () => clearInterval(autoRotateRef.current);
  }, [cards.length]);

  const goToCard = useCallback((index) => {
    clearInterval(autoRotateRef.current);
    setActiveCard(index);
    autoRotateRef.current = setInterval(() => {
      setActiveCard(prev => (prev + 1) % cards.length);
    }, 4000);
  }, [cards.length]);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) goToCard((activeCard + 1) % cards.length);
      else goToCard((activeCard - 1 + cards.length) % cards.length);
    }
    touchStartX.current = null;
  };

  const currentCard = cards[activeCard];

  return (
    <div className="content-feed">

      {/* ── ROTATING CARD ── */}
      {cards.length > 0 && currentCard && (
        <div
          className="cf-card"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{ '--card-accent': currentCard.tag_color || '#6a5cff' }}
        >
          <div className="cf-card-inner">
            <div className="cf-card-top">
              <span className="cf-tag" style={{
                background: `${currentCard.tag_color}20`,
                color: currentCard.tag_color,
                borderColor: `${currentCard.tag_color}40`
              }}>
                {currentCard.emoji} {currentCard.tag}
              </span>
              <span className="cf-card-counter">{activeCard + 1} / {cards.length}</span>
            </div>
            <h3 className="cf-card-title">{currentCard.title}</h3>
            <p className="cf-card-sub">{currentCard.subtitle}</p>
            {currentCard.cta_text && (
              <a 
                href={currentCard.cta_url || '#'}
                className="cf-card-cta"
                style={{
                  background: `linear-gradient(135deg, ${currentCard.tag_color}, ${currentCard.tag_color}99)`
                }}
                target={currentCard.cta_url ? '_blank' : undefined}
                rel="noopener noreferrer"
                onClick={e => { if (!currentCard.cta_url) e.preventDefault() }}
              >
                {currentCard.cta_text} →
              </a>
            )}
          </div>
          <div className="cf-dots">
            {cards.map((_, i) => (
              <button
                key={i}
                className={`cf-dot ${i === activeCard ? 'active' : ''}`}
                onClick={() => goToCard(i)}
                style={{ '--dot-color': currentCard.tag_color }}
              />
            ))}
          </div>
          <div className="cf-progress-bar">
            <div
              className="cf-progress-fill"
              style={{ background: currentCard.tag_color }}
              key={activeCard}
            />
          </div>
        </div>
      )}

      {/* ── VIDEO SECTION ── */}
      <div className="cf-video-section">
        <div className="cf-video-header">
          <span className="cf-video-label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#ff0000', marginRight: '0.4rem' }}>
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/>
              <polygon points="9.545 15.568 15.818 12 9.545 8.432 9.545 15.568" fill="white"/>
            </svg>
            Latest from vAIbes
          </span>
        </div>

        {/* ── INLINE PLAYER ── */}
        {playingVideo && (
          <div className="cf-inline-player">
            <div className="cf-player-header">
              <span className="cf-player-title">{playingVideo.title}</span>
              <button
                className="cf-player-close"
                onClick={() => setPlayingVideo(null)}
              >✕</button>
            </div>
            <div className="cf-player-wrap">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${playingVideo.videoId}?autoplay=1&rel=0&modestbranding=1`}
                title={playingVideo.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ width: '100%', aspectRatio: '16/9', borderRadius: '10px', border: 'none' }}
              />
            </div>
          </div>
        )}

        {/* ── THUMBNAIL GRID ── */}
        {loadingVideos ? (
          <div className="cf-video-grid">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="cf-video-skeleton">
                <div className="cf-skeleton-thumb" />
                <div className="cf-skeleton-line" />
                <div className="cf-skeleton-line short" />
              </div>
            ))}
          </div>
        ) : videos.length === 0 ? (
          <div className="cf-video-empty">
            <span>No videos found</span>
            <span style={{ fontSize: '0.72rem', opacity: 0.5 }}>
              Check your YouTube channel ID
            </span>
          </div>
        ) : (
          <div className="cf-video-grid">
            {videos.map((video) => (
              <div
                key={video.videoId}
                className={`cf-video-item ${hoveredVideo === video.videoId ? 'hovered' : ''} ${playingVideo?.videoId === video.videoId ? 'playing' : ''}`}
                onMouseEnter={() => setHoveredVideo(video.videoId)}
                onMouseLeave={() => setHoveredVideo(null)}
                onClick={() => setPlayingVideo(
                  playingVideo?.videoId === video.videoId ? null : video
                )}
              >
                {/* Thumbnail */}
                <div className="cf-video-thumb-wrap">
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="cf-video-thumb"
                    onError={e => { e.target.src = video.thumbnailFallback }}
                  />
                  {/* Play overlay */}
                  <div className="cf-play-overlay">
                    {playingVideo?.videoId === video.videoId ? (
                      <div className="cf-playing-indicator">
                        <span/><span/><span/>
                      </div>
                    ) : (
                      <div className="cf-play-btn">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                          <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="cf-video-badge">YouTube</div>
                </div>
                {/* Info */}
                <div className="cf-video-info">
                  <p className="cf-video-title">{video.title}</p>
                  <span className="cf-video-date">{video.published}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default ContentFeed;