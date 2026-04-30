// StudyModeModal.jsx
import React, { useState, useRef, useEffect } from 'react';
import './StudyMode.css';

const STATIONS = [
  { name: 'Lo-Fi Beats', url: 'https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1&loop=1&playlist=jfKfPfyJRdk', emoji: '🎧' },
  { name: 'Jazz Cafe', url: 'https://www.youtube.com/embed/DosHq1V9kP8?autoplay=1&loop=1&playlist=DosHq1V9kP8', emoji: '☕' },
  { name: 'Deep Focus', url: 'https://www.youtube.com/embed/5qap5aO4i9A?autoplay=1&loop=1&playlist=5qap5aO4i9A', emoji: '🧠' },
  { name: 'Rainy Day', url: 'https://www.youtube.com/embed/6ZjK8ya6vYY?autoplay=1&loop=1&playlist=6ZjK8ya6vYY', emoji: '🌧️' },
];

const StudyModeModal = ({ onClose }) => {
  const [currentStation, setCurrentStation] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [customUrl, setCustomUrl] = useState('');
  const audioRef = useRef(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const playStation = (station) => {
    if (audioRef.current) {
      audioRef.current.src = station.url;
      audioRef.current.play();
      setCurrentStation(station);
      setPlaying(true);
    }
  };

  const playCustom = () => {
    if (!customUrl) return;
    const videoId = extractYouTubeId(customUrl);
    if (!videoId) {
      alert('Invalid YouTube URL');
      return;
    }
    const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}`;
    if (audioRef.current) {
      audioRef.current.src = embedUrl;
      audioRef.current.play();
      setCurrentStation({ name: 'Custom', url: embedUrl, emoji: '🎵' });
      setPlaying(true);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause();
    else audioRef.current.play();
    setPlaying(!playing);
  };

  const extractYouTubeId = (url) => {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[7]?.length === 11 ? match[7] : null;
  };

  return (
    <div className="study-mode-modal-content">
      <audio ref={audioRef} onEnded={() => setPlaying(false)} />
      
      {/* Current playing row */}
      <div className="current-row">
        <div className="current-emoji">{currentStation?.emoji || '🎵'}</div>
        <div className="current-name">{currentStation?.name || 'Nothing playing'}</div>
        <button className="playpause-btn" onClick={togglePlay}>
          {playing ? '⏸️' : '▶️'}
        </button>
      </div>

      {/* Volume slider */}
      <div className="volume-row">
        <span>🔊 Volume</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="volume-slider"
        />
        <span>{Math.round(volume * 100)}%</span>
      </div>

      {/* Stations grid */}
      <div className="stations-grid">
        {STATIONS.map((station) => (
          <button
            key={station.name}
            className={`station-btn ${currentStation?.name === station.name ? 'active' : ''}`}
            onClick={() => playStation(station)}
          >
            <span className="station-emoji">{station.emoji}</span>
            <span className="station-name">{station.name}</span>
            {currentStation?.name === station.name && playing && (
              <span className="playing-indicator">🔊</span>
            )}
          </button>
        ))}
      </div>

      {/* Custom YouTube URL */}
      <div className="custom-section">
        <label>🔗 Play any YouTube video</label>
        <div className="custom-input-group">
          <input
            type="text"
            placeholder="Paste YouTube link here..."
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && playCustom()}
          />
          <button onClick={playCustom}>Play</button>
        </div>
      </div>

      <div className="study-credit">Study Mode · Focus music from YouTube</div>
    </div>
  );
};

export default StudyModeModal;