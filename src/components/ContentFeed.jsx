import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import './ContentFeed.css'; // we'll add the new styles below

const YOUTUBE_CHANNELS = [
  { id: 'UCsFG39ve0KyCDXUoUDGGhog', label: 'vAIbes' },
];

// Extract YouTube ID from any URL
const getYouTubeId = (url) => {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[7]?.length === 11 ? match[7] : null;
};

// Fetch RSS and convert to video objects
const parseYouTubeRSS = async (channelId) => {
  try {
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(rssUrl)}`;
    const res = await fetch(proxyUrl);
    const json = await res.json();
    const parser = new DOMParser();
    const xml = parser.parseFromString(json.contents, 'text/xml');
    const entries = xml.querySelectorAll('entry');
    return Array.from(entries).slice(0, 12).map(entry => {
      const videoId = entry.querySelector('videoId')?.textContent;
      const title = entry.querySelector('title')?.textContent;
      const published = entry.querySelector('published')?.textContent;
      return {
        id: videoId,
        videoId,
        title,
        published: published ? new Date(published).toLocaleDateString() : '',
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        fallbackThumb: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        type: 'youtube'
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
  const [selectedVideo, setSelectedVideo] = useState(null); // for bottom player
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [linkInput, setLinkInput] = useState('');
  const [customVideos, setCustomVideos] = useState([]);
  const autoRotateRef = useRef(null);

  // Fetch cards from Supabase
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

  // Fetch YouTube channel videos
  useEffect(() => {
    const fetchVideos = async () => {
      setLoadingVideos(true);
      const results = await parseYouTubeRSS(YOUTUBE_CHANNELS[0].id);
      setVideos(results);
      setLoadingVideos(false);
    };
    fetchVideos();
  }, []);

  // Auto-rotate cards
  useEffect(() => {
    if (cards.length === 0) return;
    autoRotateRef.current = setInterval(() => {
      setActiveCard(prev => (prev + 1) % cards.length);
    }, 5000);
    return () => clearInterval(autoRotateRef.current);
  }, [cards.length]);

  const goToCard = (index) => {
    clearInterval(autoRotateRef.current);
    setActiveCard(index);
    autoRotateRef.current = setInterval(() => {
      setActiveCard(prev => (prev + 1) % cards.length);
    }, 5000);
  };

  // Add video from custom link
  const addVideoFromLink = () => {
    const videoId = getYouTubeId(linkInput);
    if (!videoId) {
      alert('Invalid YouTube URL');
      return;
    }
    const newVideo = {
      id: `custom-${Date.now()}`,
      videoId,
      title: 'Custom Video',
      published: new Date().toLocaleDateString(),
      thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      fallbackThumb: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
      url: linkInput,
      type: 'custom'
    };
    setCustomVideos(prev => [newVideo, ...prev]);
    setLinkInput('');
  };

  const allVideos = [...customVideos, ...videos];
  const currentCard = cards[activeCard];

  return (
    <div className="content-feed">
      {/* Rotating Card */}
      {cards.length > 0 && currentCard && (
        <div className="cf-card" style={{ '--card-accent': currentCard.tag_color || '#6a5cff' }}>
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
              <a href={currentCard.cta_url || '#'} className="cf-card-cta"
                 style={{ background: `linear-gradient(135deg, ${currentCard.tag_color}, ${currentCard.tag_color}99)` }}
                 target="_blank" rel="noopener noreferrer">
                {currentCard.cta_text} →
              </a>
            )}
          </div>
          <div className="cf-dots">
            {cards.map((_, i) => (
              <button key={i} className={`cf-dot ${i === activeCard ? 'active' : ''}`}
                      onClick={() => goToCard(i)} style={{ '--dot-color': currentCard.tag_color }} />
            ))}
          </div>
          <div className="cf-progress-bar">
            <div className="cf-progress-fill" style={{ background: currentCard.tag_color }} key={activeCard} />
          </div>
        </div>
      )}

      {/* Video Gallery Header + URL Input */}
      <div className="cf-gallery-header">
        <div className="cf-video-label">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#ff0000', marginRight: '0.5rem' }}>
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/>
            <polygon points="9.545 15.568 15.818 12 9.545 8.432 9.545 15.568" fill="white"/>
          </svg>
          Latest from vAIbes
        </div>
        <div className="cf-url-input">
          <input
            type="text"
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            placeholder="Paste YouTube link..."
            onKeyPress={(e) => e.key === 'Enter' && addVideoFromLink()}
          />
          <button onClick={addVideoFromLink}>+ Add</button>
        </div>
      </div>

      {/* Video Grid - Streaming Style */}
      {loadingVideos && videos.length === 0 ? (
        <div className="cf-video-grid">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="cf-video-skeleton">
              <div className="cf-skeleton-thumb" />
              <div className="cf-skeleton-line" />
            </div>
          ))}
        </div>
      ) : (
        <div className="cf-video-grid">
          {allVideos.map((video) => (
            <div
              key={video.id}
              className="cf-video-item"
              onClick={() => setSelectedVideo(video)}
            >
              <div className="cf-video-thumb-wrap">
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="cf-video-thumb"
                  onError={e => e.target.src = video.fallbackThumb}
                />
                <div className="cf-play-overlay">
                  <div className="cf-play-btn">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="cf-video-info">
                <p className="cf-video-title">{video.title}</p>
                <span className="cf-video-date">{video.published}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loadingVideos && allVideos.length === 0 && (
        <div className="cf-video-empty">
          <span>No videos found</span>
          <span>Check your channel ID or add a link above</span>
        </div>
      )}

      {/* Bottom Modal Player (appears below chat) */}
      {selectedVideo && (
        <div className="cf-bottom-player">
          <div className="cf-player-bar">
            <span className="cf-player-title">{selectedVideo.title}</span>
            <button className="cf-player-close" onClick={() => setSelectedVideo(null)}>✕</button>
          </div>
          <div className="cf-player-container">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${selectedVideo.videoId}?autoplay=1&rel=0&modestbranding=1`}
              title={selectedVideo.title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentFeed;