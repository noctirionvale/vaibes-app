import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const stations = [
  { id: 'lofi',      name: 'Lo-fi Hip Hop', emoji: '🎧', color: '#6a5cff', youtubeId: 'BCxTQq0UiFs' },
  { id: 'ambient',   name: 'Ambient Nature', emoji: '🌿', color: '#10b981', youtubeId: 'DRFHklnN-SM' },
  { id: 'jazz',      name: 'Jazz Cafe',      emoji: '☕', color: '#d97706', youtubeId: 'MYPVQccHhAQ' },
  { id: 'focus',     name: 'Deep Focus',     emoji: '🧠', color: '#8b5cf6', youtubeId: 'oPVte6aMprI' },
  { id: 'classical', name: 'Classical',      emoji: '🎻', color: '#ec4899', youtubeId: 'mIYzp5rcTvU' },
];

const extractYoutubeId = (url) => {
  const regex = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
};

const StudyMode = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen]                     = useState(false);
  const [currentStation, setCurrentStation]     = useState(null);
  const [isPlaying, setIsPlaying]               = useState(false);
  const [volume, setVolume]                     = useState(50);
  const [customYoutubeUrl, setCustomYoutubeUrl] = useState('');
  const containerRef = useRef(null);

  /* ── close on outside click ── */
  useEffect(() => {
    if (!isOpen) return;
    const close = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown',  close);
    document.addEventListener('touchstart', close);
    return () => {
      document.removeEventListener('mousedown',  close);
      document.removeEventListener('touchstart', close);
    };
  }, [isOpen]);

  /* ── keep AudioContext alive so YouTube doesn't pause in background ── */
  useEffect(() => {
    if (!isPlaying || !currentStation) return;
    let audioCtx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        audioCtx = new AC();
        const osc  = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        gain.gain.value = 0.001;
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
      }
    } catch (e) {}
    return () => audioCtx?.close();
  }, [isPlaying, currentStation]);

  /* ── load saved station ── */
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('user_preferences')
          .select('study_song_audio_url')
          .eq('user_id', user.id)
          .maybeSingle();
        if (error || !data?.study_song_audio_url) return;
        const saved = stations.find(s => s.youtubeId === data.study_song_audio_url);
        setCurrentStation(saved ?? {
          id: 'custom', name: 'Custom YouTube',
          emoji: '📺', color: '#6a5cff',
          youtubeId: data.study_song_audio_url,
        });
        setIsPlaying(true);
      } catch (e) {}
    })();
  }, [user?.id]);

  /* ── helpers ── */
  const savePreference = async (youtubeId) => {
    if (!user) return;
    try {
      await supabase.from('user_preferences').upsert(
        { user_id: user.id, study_song_audio_url: youtubeId, study_song_type: 'youtube', updated_at: new Date() },
        { onConflict: 'user_id' }
      );
    } catch (e) {}
  };

  const handleStationSelect = (station) => {
    if (currentStation?.id === station.id && isPlaying) {
      setIsPlaying(false);
    } else {
      setCurrentStation(station);
      setIsPlaying(true);
      savePreference(station.youtubeId);
    }
  };

  const handleCustomYoutube = () => {
    const videoId = extractYoutubeId(customYoutubeUrl);
    if (!videoId) { alert('Invalid YouTube URL'); return; }
    const custom = { id: 'custom', name: 'Custom YouTube', emoji: '📺', color: '#6a5cff', youtubeId: videoId };
    setCurrentStation(custom);
    setIsPlaying(true);
    savePreference(videoId);
    setCustomYoutubeUrl('');
  };

  const getYouTubeUrl = (station) =>
    `https://www.youtube-nocookie.com/embed/${station.youtubeId}?autoplay=1&loop=1&playlist=${station.youtubeId}&controls=0&modestbranding=1&rel=0&showinfo=0&mute=0&volume=${volume}`;

  /* ────────────────────────────── RENDER ────────────────────────────── */
  return (
    <div
      ref={containerRef}
      className="study-mode-container"
      style={{ position: 'relative', width: '100%' }}
    >
      {/* Toggle button */}
      <button
        className={`study-mode-toggle ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(prev => !prev)}
      >
        <span className="study-mode-icon">{isPlaying ? '🎵' : '🎓'}</span>
        <div className="study-mode-toggle-text">
          <span className="study-mode-label">Study Mode</span>
          <span className="study-mode-sublabel">
            {isPlaying && currentStation ? `${currentStation.emoji} ${currentStation.name}` : ''}
          </span>
        </div>
        {isPlaying && (
          <div className="study-mode-equalizer">
            <span /><span /><span /><span />
          </div>
        )}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease', flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          className="study-mode-panel"
          style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999, marginTop: '4px' }}
        >
          {/* Now Playing */}
          {currentStation && (
            <div className="study-now-playing" style={{ borderColor: currentStation.color + '40' }}>
              <div className="study-now-playing-info">
                <span className="study-now-playing-emoji">{currentStation.emoji}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="study-now-playing-name">{currentStation.name}</div>
                  <div className="study-now-playing-status">{isPlaying ? '▶ Playing' : '⏸ Paused'}</div>
                </div>
              </div>
              <button
                className="study-playpause-btn"
                onClick={() => setIsPlaying(prev => !prev)}
                style={{ background: currentStation.color }}
              >
                {isPlaying ? '⏸' : '▶'}
              </button>
            </div>
          )}

          {/* Volume */}
          <div className="study-volume-row">
            <span>🔈</span>
            <input type="range" min="0" max="100" value={volume}
              onChange={e => setVolume(Number(e.target.value))}
              className="study-volume-slider" />
            <span>🔊</span>
          </div>

          {/* Stations */}
          <div className="study-stations">
            <div className="study-section-label">🎧 Recommended Stations</div>
            {stations.map(station => (
              <button
                key={station.id}
                className={`study-station-btn ${currentStation?.id === station.id ? 'active' : ''}`}
                onClick={() => handleStationSelect(station)}
                style={currentStation?.id === station.id
                  ? { borderColor: station.color, background: station.color + '15' } : {}}
              >
                <span className="study-station-emoji">{station.emoji}</span>
                <span className="study-station-name">{station.name}</span>
                {currentStation?.id === station.id && isPlaying && (
                  <div className="study-station-playing" style={{ color: station.color }}>
                    <span /><span /><span />
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Custom YouTube */}
          <div className="study-custom-youtube">
            <div className="study-section-label">📺 Custom YouTube</div>
            <div className="study-youtube-input-group">
              <input
                type="text"
                placeholder="Paste YouTube URL..."
                value={customYoutubeUrl}
                onChange={e => setCustomYoutubeUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCustomYoutube()}
                className="study-youtube-input"
              />
              <button onClick={handleCustomYoutube} className="study-youtube-btn">
                ▶ Play
              </button>
            </div>
          </div>

          <p className="study-mode-credit">🎬 Powered by YouTube</p>
        </div>
      )}

      {/*
        ── THE FIX: key={currentStation.youtubeId} ──
        Every time the station changes, React sees a different key,
        fully unmounts the old iframe (stopping playback) and mounts
        a fresh one. No more double-play / ghost audio.
        When isPlaying is false the iframe is removed entirely.
      */}
      {currentStation && isPlaying && (
        <iframe
          key={currentStation.youtubeId}
          src={getYouTubeUrl(currentStation)}
          style={{ display: 'none' }}
          allow="autoplay"
          title="Study Music"
        />
      )}
    </div>
  );
};

export default StudyMode;