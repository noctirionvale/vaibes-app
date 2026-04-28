import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import './ContentFeed.css';

const YOUTUBE_CHANNELS = [
  { id: 'UCsFG39ve0KyCDXUoUDGGhog', label: 'vAIbes' },
];

const getYouTubeId = (url) => {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[7]?.length === 11 ? match[7] : null;
};

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
      const thumbBase = `https://img.youtube.com/vi/${videoId}`;
      return {
        id: videoId,
        videoId,
        title,
        published: published ? new Date(published).toLocaleDateString() : '',
        thumbnail: `${thumbBase}/mqdefault.jpg`,
        fallbackThumb: `${thumbBase}/hqdefault.jpg`,
        url: `https://www.youtube.com/watch?v=${videoId}`,
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
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [linkInput, setLinkInput] = useState('');
  const [customVideos, setCustomVideos] = useState([]);
  const autoRotateRef = useRef(null);
  const scrollContainerRef = useRef(null);
  
  const [playerSize, setPlayerSize] = useState({ width: 640, height: 380 });
  // Centered initial position
  const [playerPosition, setPlayerPosition] = useState(() => ({
    x: (window.innerWidth - 640) / 2,
    y: (window.innerHeight - 380) / 2,
  }));
  const [isResizing, setIsResizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, startPos: { x: 0, y: 0 } });
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0, left: 0, top: 0 });

  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  // --- fetch cards & videos (unchanged) ---
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

  const nextCard = () => goToCard((activeCard + 1) % cards.length);
  const prevCard = () => goToCard((activeCard - 1 + cards.length) % cards.length);

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
      thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
      fallbackThumb: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      url: linkInput,
    };
    setCustomVideos(prev => [newVideo, ...prev]);
    setLinkInput('');
  };

  const allVideos = [...customVideos, ...videos];
  const currentCard = cards[activeCard];

  // --- scroll handlers for carousel ---
  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -300, behavior: 'smooth' });
    }
  };
  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 300, behavior: 'smooth' });
    }
  };
  const updateScrollArrows = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setShowLeftArrow(scrollLeft > 20);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 20);
    }
  };

  // --- DRAG LOGIC (mouse + touch) ---
  const startDrag = (e) => {
    if (e.target.closest('.cf-resize-handle')) return;
    e.preventDefault();
    setIsDragging(true);
    const clientX = e.clientX ?? e.touches[0].clientX;
    const clientY = e.clientY ?? e.touches[0].clientY;
    dragStartRef.current = {
      x: clientX - playerPosition.x,
      y: clientY - playerPosition.y,
      startPos: { x: playerPosition.x, y: playerPosition.y },
    };
  };

  useEffect(() => {
  if (!isDragging) return;

  const onDragMove = (moveEvent) => {
    const clientX = moveEvent.clientX ?? moveEvent.touches[0].clientX;
    const clientY = moveEvent.clientY ?? moveEvent.touches[0].clientY;
    let newX = clientX - dragStartRef.current.x;
    let newY = clientY - dragStartRef.current.y;
    newX = Math.min(window.innerWidth - 50, Math.max(0, newX));
    newY = Math.min(window.innerHeight - 50, Math.max(0, newY));
    setPlayerPosition({ x: newX, y: newY });
  };

  const stopDrag = () => {
    setIsDragging(false);
  };

  window.addEventListener('mousemove', onDragMove);
  window.addEventListener('mouseup', stopDrag);
  window.addEventListener('touchmove', onDragMove, { passive: false });
  window.addEventListener('touchend', stopDrag);

  return () => {
    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('mouseup', stopDrag);
    window.removeEventListener('touchmove', onDragMove);
    window.removeEventListener('touchend', stopDrag);
  };
}, [isDragging]);

  // --- RESIZE LOGIC (mouse + touch) ---
  const startResize = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    const clientX = e.clientX ?? e.touches[0].clientX;
    const clientY = e.clientY ?? e.touches[0].clientY;
    resizeStartRef.current = {
      x: clientX,
      y: clientY,
      width: playerSize.width,
      height: playerSize.height,
      left: playerPosition.x,
      top: playerPosition.y,
    };
  };

  useEffect(() => {
  if (!isResizing) return;

  const onResizeMove = (moveEvent) => {
    const clientX = moveEvent.clientX ?? moveEvent.touches[0].clientX;
    const clientY = moveEvent.clientY ?? moveEvent.touches[0].clientY;
    const deltaX = clientX - resizeStartRef.current.x;
    const deltaY = clientY - resizeStartRef.current.y;
    let newWidth = Math.min(1200, Math.max(400, resizeStartRef.current.width + deltaX));
    let newHeight = Math.min(700, Math.max(260, resizeStartRef.current.height + deltaY));
    let newLeft = resizeStartRef.current.left;
    let newTop = resizeStartRef.current.top;
    newLeft = Math.min(window.innerWidth - 50, Math.max(0, newLeft));
    newTop = Math.min(window.innerHeight - 50, Math.max(0, newTop));
    setPlayerSize({ width: newWidth, height: newHeight });
    setPlayerPosition({ x: newLeft, y: newTop });
  };

  const stopResize = () => {
    setIsResizing(false);
  };

  window.addEventListener('mousemove', onResizeMove);
  window.addEventListener('mouseup', stopResize);
  window.addEventListener('touchmove', onResizeMove, { passive: false });
  window.addEventListener('touchend', stopResize);

  return () => {
    window.removeEventListener('mousemove', onResizeMove);
    window.removeEventListener('mouseup', stopResize);
    window.removeEventListener('touchmove', onResizeMove);
    window.removeEventListener('touchend', stopResize);
  };
}, [isResizing]);

  // Double‑click to re‑center
  const recenterPlayer = () => {
    setPlayerPosition({
      x: (window.innerWidth - playerSize.width) / 2,
      y: (window.innerHeight - playerSize.height) / 2,
    });
  };

  return (
    <div className="content-feed">
      {/* Rotating Card (unchanged) */}
      {cards.length > 0 && currentCard && (
        <div className="cf-card" style={{ '--card-accent': currentCard.tag_color || '#6a5cff' }}>
          <button className="cf-card-arrow cf-card-arrow-left" onClick={prevCard} aria-label="Previous card">‹</button>
          <button className="cf-card-arrow cf-card-arrow-right" onClick={nextCard} aria-label="Next card">›</button>
          
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
            
            {currentCard.video_url && (() => {
              const previewId = getYouTubeId(currentCard.video_url);
              if (previewId) {
                return (
                  <div className="cf-card-video-preview" onClick={() => setSelectedVideo({ videoId: previewId, title: currentCard.title })}>
                    <img src={`https://img.youtube.com/vi/${previewId}/mqdefault.jpg`} alt="preview" />
                    <div className="cf-play-overlay-small">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </div>
                  </div>
                );
              }
              return null;
            })()}
            
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

      {/* Gallery Header + URL Input */}
      <div className="cf-gallery-header">
        <div className="cf-video-label">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#ff0000', marginRight: '0.5rem' }}>
            <path d="M23.498 6.186..."/>
            <polygon points="9.545 15.568 15.818 12 9.545 8.432 9.545 15.568" fill="white"/>
          </svg>
          Latest from vAIbes
        </div>
        <div className="cf-url-input">
          <input type="text" value={linkInput} onChange={(e) => setLinkInput(e.target.value)} placeholder="Paste YouTube link..." onKeyPress={(e) => e.key === 'Enter' && addVideoFromLink()} />
          <button onClick={addVideoFromLink}>+ Add</button>
        </div>
      </div>

      {/* Horizontal Scrollable Video Grid */}
      <div className="cf-video-carousel">
        {showLeftArrow && (
          <button className="cf-carousel-arrow cf-carousel-left" onClick={scrollLeft}>‹</button>
        )}
        <div 
          className="cf-video-grid-scroll" 
          ref={scrollContainerRef}
          onScroll={updateScrollArrows}
        >
          {loadingVideos && videos.length === 0 ? (
            [...Array(6)].map((_, i) => (
              <div key={i} className="cf-video-skeleton">
                <div className="cf-skeleton-thumb" />
                <div className="cf-skeleton-line" />
              </div>
            ))
          ) : (
            allVideos.map((video) => (
              <div key={video.id} className="cf-video-item" onClick={() => setSelectedVideo(video)}>
                <div className="cf-video-thumb-wrap">
                  <img src={video.thumbnail} alt={video.title} className="cf-video-thumb" onError={e => e.target.src = video.fallbackThumb} />
                  <div className="cf-play-overlay"><div className="cf-play-btn"><svg width="24" height="24" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg></div></div>
                </div>
                <div className="cf-video-info"><p className="cf-video-title">{video.title}</p><span className="cf-video-date">{video.published}</span></div>
              </div>
            ))
          )}
        </div>
        {showRightArrow && allVideos.length > 0 && (
          <button className="cf-carousel-arrow cf-carousel-right" onClick={scrollRight}>›</button>
        )}
      </div>

      {/* Draggable & Resizable Player (touch + mouse) */}
      {selectedVideo && (
        <div 
          className="cf-bottom-player" 
          style={{ 
            width: playerSize.width, 
            height: playerSize.height, 
            top: playerPosition.y, 
            left: playerPosition.x,
            transition: (isResizing || isDragging) ? 'none' : 'all 0.2s',
            cursor: isDragging ? 'grabbing' : 'auto'
          }}
        >
          <div 
            className="cf-player-bar" 
            onMouseDown={startDrag}
            onTouchStart={startDrag}
            onDoubleClick={recenterPlayer}
            style={{ cursor: 'grab', touchAction: 'none' }}
          >
            <span className="cf-player-title">{selectedVideo.title}</span>
            <button className="cf-player-close" onClick={() => setSelectedVideo(null)}>✕</button>
          </div>
          <div className="cf-player-container" style={{ height: `calc(100% - 40px)` }}>
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${selectedVideo.videoId}?autoplay=1&rel=0&modestbranding=1`}
              title={selectedVideo.title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ width: '100%', height: '100%', pointerEvents: (isDragging || isResizing) ? 'none' : 'auto' }}
            />
          </div>
          <div 
            className="cf-resize-handle" 
            onMouseDown={startResize}
            onTouchStart={startResize}
            title="Drag to resize"
            style={{ touchAction: 'none' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22 2v20H2V2h20zM4 4v16h16V4H4z"/>
              <path d="M18 18h-4v-4h4v4zM10 10H6v4h4v-4z"/>
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentFeed;