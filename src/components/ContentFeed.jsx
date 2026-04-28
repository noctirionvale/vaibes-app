import React, { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import ContentFeed from './ContentFeed';

// ── PASTE YOUR YOUTUBE CHANNEL IDs HERE ──
const YOUTUBE_CHANNELS = [
  { id: 'UCFuDhy4tFjvWnRwvATM7H8Q', label: 'vAIbes' },
  { id: 'UCsFG39ve0KyCDXUoUDGGhog', label: 'Channel 2' },
  { id: 'UCL-kP2OlQdYF3z06l1GjqjA', label: 'Channel 3' },
]

const parseYouTubeRSS = async (channelId) => {
  try {
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(rssUrl)}`
    const res = await fetch(proxyUrl)
    const json = await res.json()
    const parser = new DOMParser()
    const xml = parser.parseFromString(json.contents, 'text/xml')
    const entries = xml.querySelectorAll('entry')
    return Array.from(entries).slice(0, 4).map(entry => {
      const videoId = entry.querySelector('videoId')?.textContent
      const title = entry.querySelector('title')?.textContent
      const published = entry.querySelector('published')?.textContent
      return {
        videoId,
        title,
        published: published ? new Date(published).toLocaleDateString() : '',
        thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        url: `https://www.youtube.com/watch?v=${videoId}`
      }
    })
  } catch {
    return []
  }
}

const ContentFeed = () => {
  const [cards, setCards] = useState([])
  const [videos, setVideos] = useState([])
  const [activeCard, setActiveCard] = useState(0)
  const [activeChannel, setActiveChannel] = useState(0)
  const [loadingVideos, setLoadingVideos] = useState(true)
  const autoRotateRef = useRef(null)
  const touchStartX = useRef(null)

  // Fetch cards from Supabase
  useEffect(() => {
    const fetchCards = async () => {
      const { data } = await supabase
        .from('content_cards')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
      if (data) setCards(data)
    }
    fetchCards()
  }, [])

  // Fetch YouTube videos
  useEffect(() => {
    const fetchVideos = async () => {
      setLoadingVideos(true)
      const results = await parseYouTubeRSS(YOUTUBE_CHANNELS[activeChannel].id)
      setVideos(results)
      setLoadingVideos(false)
    }
    fetchVideos()
  }, [activeChannel])

  // Auto-rotate cards
  useEffect(() => {
    if (cards.length === 0) return
    autoRotateRef.current = setInterval(() => {
      setActiveCard(prev => (prev + 1) % cards.length)
    }, 4000)
    return () => clearInterval(autoRotateRef.current)
  }, [cards.length])

  const goToCard = useCallback((index) => {
    clearInterval(autoRotateRef.current)
    setActiveCard(index)
    autoRotateRef.current = setInterval(() => {
      setActiveCard(prev => (prev + 1) % cards.length)
    }, 4000)
  }, [cards.length])

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 40) {
      if (diff > 0) goToCard((activeCard + 1) % cards.length)
      else goToCard((activeCard - 1 + cards.length) % cards.length)
    }
    touchStartX.current = null
  }

  const currentCard = cards[activeCard]
  const currentVideo = videos[activeCard % (videos.length || 1)] // eslint-disable-line

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
              <span
                className="cf-tag"
                style={{
                  background: `${currentCard.tag_color}20`,
                  color: currentCard.tag_color,
                  borderColor: `${currentCard.tag_color}40`
                }}
              >
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

          {/* Progress dots */}
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

          {/* Progress bar */}
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
          <span className="cf-video-label">📺 Latest Videos</span>
          <div className="cf-channel-tabs">
            {YOUTUBE_CHANNELS.map((ch, i) => (
              <button
                key={i}
                className={`cf-channel-tab ${i === activeChannel ? 'active' : ''}`}
                onClick={() => setActiveChannel(i)}
              >
                {ch.label}
              </button>
            ))}
          </div>
        </div>

        {loadingVideos ? (
          <div className="cf-video-loading">Loading videos...</div>
        ) : videos.length === 0 ? (
          <div className="cf-video-loading">No videos found</div>
        ) : (
          <div className="cf-video-grid">
            {videos.map((video, i) => (
              <a
                key={video.videoId}
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`cf-video-item ${i === activeCard % videos.length ? 'highlighted' : ''}`}
              >
                <div className="cf-video-thumb-wrap">
                  <img src={video.thumbnail} alt={video.title} className="cf-video-thumb" />
                  <div className="cf-play-icon">▶</div>
                </div>
                <div className="cf-video-info">
                  <p className="cf-video-title">{video.title}</p>
                  <span className="cf-video-date">{video.published}</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}

export default ContentFeed