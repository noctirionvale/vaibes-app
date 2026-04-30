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
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(rssUrl)}`;
    const res = await fetch(proxyUrl);
    const text = await res.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'text/xml');
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

const ContentFeed = ({ userTier = 'free' }) => {
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [linkInput, setLinkInput] = useState('');
  const [customVideos, setCustomVideos] = useState([]);
  const scrollContainerRef = useRef(null);
  const [featuredItems, setFeaturedItems] = useState([]);
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [featuredCard, setFeaturedCard] = useState(null);
  const [isSettingFeatured, setIsSettingFeatured] = useState(false);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const defaultSize = isMobile
    ? { width: window.innerWidth - 20, height: (window.innerWidth - 20) * 0.5625 }
    : { width: 640, height: 380 };
  const [playerSize, setPlayerSize] = useState(defaultSize);
  const [playerPosition, setPlayerPosition] = useState(() => {
    const w = isMobile ? window.innerWidth - 20 : 640;
    const h = isMobile ? (window.innerWidth - 20) * 0.5625 : 380;
    return {
      x: (window.innerWidth - w) / 2,
      y: (window.innerHeight - h) / 2,
    };
  });
  const [isResizing, setIsResizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  // Fetch featured card
  useEffect(() => {
    const fetchFeatured = async () => {
      const { data } = await supabase
        .from('content_cards')
        .select('*')
        .eq('is_featured', true)
        .maybeSingle();
      if (data) setFeaturedCard(data);
    };
    fetchFeatured();
  }, []);

  // Fetch 4 active cards
  useEffect(() => {
    const fetchFeaturedItems = async () => {
      setLoadingFeatured(true);
      const { data, error } = await supabase
        .from('content_cards')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .limit(4);
      if (error) {
        console.error("Error fetching cards:", error);
      } else if (data) {
        setFeaturedItems(data);
      }
      setLoadingFeatured(false);
    };
    fetchFeaturedItems();
  }, []);

  // Fetch YouTube RSS feed
  useEffect(() => {
    const fetchVideos = async () => {
      setLoadingVideos(true);
      const results = await parseYouTubeRSS(YOUTUBE_CHANNELS[0].id);
      setVideos(results);
      setLoadingVideos(false);
    };
    fetchVideos();
  }, []);

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

  const scrollLeft = () => {
    if (scrollContainerRef.current) scrollContainerRef.current.scrollBy({ left: -300, behavior: 'smooth' });
  };
  const scrollRight = () => {
    if (scrollContainerRef.current) scrollContainerRef.current.scrollBy({ left: 300, behavior: 'smooth' });
  };
  const updateScrollArrows = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setShowLeftArrow(scrollLeft > 20);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 20);
    }
  };

  // Drag & resize handlers (unchanged)
  const startDrag = (e) => {
    if (e.target.closest('.cf-resize-handle')) return;
    e.preventDefault();
    setIsDragging(true);
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;
    dragStartRef.current = {
      x: clientX - playerPosition.x,
      y: clientY - playerPosition.y,
    };
  };

  const startResize = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    const startX = e.clientX ?? e.touches?.[0]?.clientX;
    const startY = e.clientY ?? e.touches?.[0]?.clientY;
    const startWidth = playerSize.width;
    const startHeight = playerSize.height;
    const startLeft = playerPosition.x;
    const startTop = playerPosition.y;

    const handleMove = (moveEvent) => {
      const currentX = moveEvent.clientX ?? moveEvent.touches?.[0]?.clientX;
      const currentY = moveEvent.clientY ?? moveEvent.touches?.[0]?.clientY;
      if (!currentX || !currentY) return;
      const deltaX = currentX - startX;
      const deltaY = currentY - startY;
      let newWidth = Math.min(window.innerWidth - 20, Math.max(200, startWidth + deltaX));
      let newHeight = Math.min(window.innerHeight - 100, Math.max(140, startHeight + deltaY));
      let newLeft = startLeft;
      let newTop = startTop;
      newLeft = Math.min(window.innerWidth - newWidth - 10, Math.max(10, newLeft));
      newTop = Math.min(window.innerHeight - newHeight - 10, Math.max(10, newTop));
      setPlayerSize({ width: newWidth, height: newHeight });
      setPlayerPosition({ x: newLeft, y: newTop });
    };

    const handleUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleUp);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleUp);
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (moveEvent) => {
      const clientX = moveEvent.clientX ?? moveEvent.touches?.[0]?.clientX;
      const clientY = moveEvent.clientY ?? moveEvent.touches?.[0]?.clientY;
      if (!clientX || !clientY) return;
      let newX = clientX - dragStartRef.current.x;
      let newY = clientY - dragStartRef.current.y;
      newX = Math.min(window.innerWidth - playerSize.width - 10, Math.max(10, newX));
      newY = Math.min(window.innerHeight - playerSize.height - 10, Math.max(10, newY));
      setPlayerPosition({ x: newX, y: newY });
    };
    const handleUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleUp);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleUp);
    };
  }, [isDragging, playerSize.width, playerSize.height]);

  const toggleSize = () => {
    if (isMobile) {
      const isFull = playerSize.width > window.innerWidth * 0.8;
      if (isFull) {
        const smallW = window.innerWidth * 0.7;
        const smallH = smallW * 0.5625;
        setPlayerSize({ width: smallW, height: smallH });
        setPlayerPosition({
          x: (window.innerWidth - smallW) / 2,
          y: window.innerHeight - smallH - 50,
        });
      } else {
        const fullW = window.innerWidth - 20;
        const fullH = fullW * 0.5625;
        setPlayerSize({ width: fullW, height: fullH });
        setPlayerPosition({
          x: 10,
          y: (window.innerHeight - fullH) / 2,
        });
      }
    }
  };

  const isYouTubeUrl = (url) => {
    return url && (url.includes('youtube.com') || url.includes('youtu.be'));
  };

  // FIXED: setAsFeatured without the illegal .neq('id', '')
  const setAsFeatured = async (item) => {
    setIsSettingFeatured(true);
    try {
      // Find the currently featured card (if any)
      const { data: currentFeatured } = await supabase
        .from('content_cards')
        .select('id')
        .eq('is_featured', true)
        .maybeSingle();

      // Unset current featured if exists
      if (currentFeatured) {
        await supabase
          .from('content_cards')
          .update({ is_featured: false })
          .eq('id', currentFeatured.id);
      }

      // Set the new card as featured
      await supabase
        .from('content_cards')
        .update({ is_featured: true })
        .eq('id', item.id);

      // Optimistically update local state
      setFeaturedItems(prev =>
        prev.map(c => ({ ...c, is_featured: c.id === item.id }))
      );
      setFeaturedCard(item);
      alert(`✨ "${item.title}" is now the featured highlight!`);
    } catch (err) {
      console.error('Failed to set featured:', err);
      alert('Could not update featured card. Please try again.');
    } finally {
      setIsSettingFeatured(false);
    }
  };

  return (
    <div className="content-feed">

      {/* Featured Highlight */}
      {featuredCard && (
        <div className="cf-featured-section">
          <div className="cf-featured-video">
            {featuredCard.trailer_url ? (
              isYouTubeUrl(featuredCard.trailer_url) ? (
                <iframe
                  className="cf-featured-video-element"
                  src={`https://www.youtube-nocookie.com/embed/${getYouTubeId(featuredCard.trailer_url)}?autoplay=1&loop=1&playlist=${getYouTubeId(featuredCard.trailer_url)}&mute=1`}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={featuredCard.title}
                />
              ) : (
                <video
                  className="cf-featured-video-element"
                  src={featuredCard.trailer_url}
                  poster={featuredCard.image_url}
                  controls
                  autoPlay
                  loop
                  muted
                  playsInline
                />
              )
            ) : (
              <img
                src={featuredCard.image_url}
                alt={featuredCard.title}
                className="cf-featured-image"
                onClick={() => setLightboxImage(featuredCard.image_url)}
                style={{ cursor: 'pointer', width: '100%', aspectRatio: '16/9', objectFit: 'cover' }}
              />
            )}
            <div className="cf-featured-video-overlay">
              <h2>{featuredCard.title}</h2>
              <p>{featuredCard.subtitle}</p>
              {featuredCard.cta_text && (
                <button className="cf-featured-cta" onClick={() => window.open(featuredCard.cta_url, '_blank')}>
                  {featuredCard.cta_text}
                </button>
              )}
              <div className="featured-badge">⭐ Featured</div>
            </div>
          </div>
        </div>
      )}

      {/* 4 Cards Grid */}
      <div className="cf-featured-grid-section">
        <div className="cf-section-header">
          <span className="cf-section-icon">🎴</span>
          <h3 className="cf-section-title">Media Gallery</h3>
          <span className="cf-section-subtitle">Click any card to make it the main feature</span>
        </div>

        <div className="cf-image-grid">
          {loadingFeatured && featuredItems.length === 0 ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="cf-image-card-skeleton">
                <div className="cf-skeleton-image" />
                <div className="cf-skeleton-text" />
              </div>
            ))
          ) : (
            featuredItems.map((item) => {
              const isYouTube = isYouTubeUrl(item.trailer_url);
              const isLiveCam = item.media_type === 'livecam' || (isYouTube && item.trailer_url?.includes('live'));
              const showDownload = !isYouTube && (item.image_url || (item.trailer_url && !isYouTube));
              return (
                <div className="cf-image-card" key={item.id}>
                  <div className="cf-image-wrapper">
                    {isLiveCam && <div className="cf-live-badge">🔴 LIVE</div>}
                    {item.trailer_url ? (
                      isYouTube ? (
                        <iframe
                          src={`https://www.youtube-nocookie.com/embed/${getYouTubeId(item.trailer_url)}?rel=0`}
                          title={item.title}
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="cf-featured-video-iframe"
                        />
                      ) : (
                        <video
                          src={item.trailer_url}
                          poster={item.image_url}
                          controls
                          className="cf-featured-video-element"
                          preload="metadata"
                        />
                      )
                    ) : (
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="cf-featured-image"
                        onClick={() => setLightboxImage(item.image_url)}
                        style={{ cursor: 'pointer' }}
                      />
                    )}
                    {item.emoji && <div className="cf-image-badge">{item.emoji}</div>}
                    {item.is_featured && <div className="cf-featured-badge-small">⭐ Featured</div>}
                  </div>

                  <div className="cf-image-info">
                    <div className="cf-image-title">{item.title}</div>
                    <div className="cf-image-description">{item.subtitle}</div>
                    <div className="cf-button-group">
                      {showDownload && (
                        <button
                          className="cf-download-button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const urlToDownload = item.trailer_url || item.image_url;
                            const ext = item.trailer_url ? 'mp4' : 'jpg';
                            const fileName = `${item.title.replace(/\s+/g, '_')}.${ext}`;
                            try {
                              const response = await fetch(urlToDownload);
                              const blob = await response.blob();
                              const blobUrl = URL.createObjectURL(blob);
                              const link = document.createElement('a');
                              link.href = blobUrl;
                              link.download = fileName;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              URL.revokeObjectURL(blobUrl);
                            } catch (err) {
                              alert('Download failed (CORS or network issue).');
                            }
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="6 17 12 23 18 17" />
                            <line x1="12" y1="2" x2="12" y2="6" />
                            <path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />
                          </svg>
                          Download {item.trailer_url ? 'Video' : 'Image'}
                        </button>
                      )}
                      <button
                        className="cf-set-featured-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAsFeatured(item);
                        }}
                        disabled={isSettingFeatured || item.is_featured}
                      >
                        ⭐ {item.is_featured ? 'Current Featured' : 'Set as Featured'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* YouTube Feed – now free for everyone */}
      <div className="cf-gallery-header">
        <div className="cf-video-label">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#ff0000', marginRight: '0.5rem' }}>
            <path d="M23.498 6.186... (your icon as before) ..." />
            <polygon points="9.545 15.568 15.818 12 9.545 8.432 9.545 15.568" fill="white" />
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
              <div key={video.id} className="cf-video-item" onClick={() => setSelectedVideo({ videoId: video.videoId, title: video.title, type: 'youtube' })}>
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
            ))
          )}
        </div>
        {showRightArrow && allVideos.length > 0 && (
          <button className="cf-carousel-arrow cf-carousel-right" onClick={scrollRight}>›</button>
        )}
      </div>

      {/* Floating video player (for YouTube feed) */}
      {selectedVideo && (
        <div
          className="cf-bottom-player"
          style={{
            width: playerSize.width,
            height: playerSize.height,
            top: playerPosition.y,
            left: playerPosition.x,
            transition: (isResizing || isDragging) ? 'none' : 'all 0.2s',
            cursor: isDragging ? 'grabbing' : 'auto',
            touchAction: 'none',
          }}
        >
          <div
            className="cf-player-bar"
            onMouseDown={startDrag}
            onTouchStart={startDrag}
            style={{ cursor: 'grab', touchAction: 'none' }}
          >
            <span className="cf-player-title">{selectedVideo.title}</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {isMobile && (
                <button className="cf-size-toggle" onClick={toggleSize} title="Resize">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4 L20 4 L20 20 L4 20 Z" />
                    <path d="M8 8 L16 8 L16 16 L8 16 Z" />
                  </svg>
                </button>
              )}
              <button className="cf-player-close" onClick={() => setSelectedVideo(null)}>✕</button>
            </div>
          </div>
          <div className="cf-player-container" style={{ height: `calc(100% - 40px)` }}>
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${selectedVideo.videoId}?autoplay=1&rel=0&modestbranding=1`}
              title={selectedVideo.title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ width: '100%', height: '100%', pointerEvents: isDragging ? 'none' : 'auto' }}
            />
          </div>
          <div
            className="cf-resize-handle"
            onMouseDown={startResize}
            onTouchStart={startResize}
            title="Drag to resize"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22 2v20H2V2h20zM4 4v16h16V4H4z" />
              <path d="M18 18h-4v-4h4v4zM10 10H6v4h4v-4z" />
            </svg>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxImage && (
        <div className="cf-lightbox" onClick={() => setLightboxImage(null)}>
          <div className="cf-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="cf-lightbox-close" onClick={() => setLightboxImage(null)}>✕</button>
            <img src={lightboxImage} alt="Full size" />
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentFeed;