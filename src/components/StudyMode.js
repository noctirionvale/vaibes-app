import React, { useState, useRef } from 'react';

const stations = [
  {
    id: 'lofi',
    name: 'Lo-fi Hip Hop',
    emoji: '🎧',
    color: '#6a5cff',
    youtubeId: 'BCxTQq0UiFs', // lofi girl
  },
  {
    id: 'ambient',
    name: 'Ambient Nature',
    emoji: '🌿',
    color: '#10b981',
    youtubeId: 'DRFHklnN-SM', // nature sounds
  },
  {
    id: 'jazz',
    name: 'Jazz Cafe',
    emoji: '☕',
    color: '#d97706',
    youtubeId: 'MYPVQccHhAQ', // jazz cafe
  },
  {
    id: 'focus',
    name: 'Deep Focus',
    emoji: '🧠',
    color: '#8b5cf6',
    youtubeId: 'oPVte6aMprI', // deep focus
  },
  {
    id: 'classical',
    name: 'Classical',
    emoji: '🎻',
    color: '#ec4899',
    youtubeId: 'mIYzp5rcTvU', // classical focus
  }
];

const StudyMode = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStation, setCurrentStation] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(50);
  const iframeRef = useRef(null);

  const handleStationSelect = (station) => {
    if (currentStation?.id === station.id) {
      // Toggle play/pause same station
      setIsPlaying(!isPlaying);
      return;
    }
    setCurrentStation(station);
    setIsPlaying(true);
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const getYouTubeUrl = (station) => {
    if (!station || !isPlaying) return '';
    return `https://www.youtube-nocookie.com/embed/${station.youtubeId}?autoplay=1&loop=1&playlist=${station.youtubeId}&controls=0&modestbranding=1&rel=0&showinfo=0&mute=0&volume=${volume}`;
  };

  return (
    <div className="study-mode-container">

      {/* Toggle Button */}
      <button
        className={"study-mode-toggle " + (isOpen ? 'active' : '')}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="study-mode-icon">
          {isPlaying ? '🎵' : '🎓'}
        </span>
        <div className="study-mode-toggle-text">
          <span className="study-mode-label">Study Mode</span>
          <span className="study-mode-sublabel">
            {isPlaying && currentStation
              ? currentStation.emoji + ' ' + currentStation.name
              : 'Click to tinker'}
          </span>
        </div>
        {isPlaying && (
          <div className="study-mode-equalizer">
            <span /><span /><span /><span />
          </div>
        )}
        <svg
          width="14" height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s ease',
            flexShrink: 0
          }}
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {/* Player Panel */}
      {isOpen && (
        <div className="study-mode-panel">

          {/* Now Playing */}
          {currentStation && (
            <div
              className="study-now-playing"
              style={{ borderColor: currentStation.color + '40' }}
            >
              <div className="study-now-playing-info">
                <span className="study-now-playing-emoji">
                  {currentStation.emoji}
                </span>
                <div>
                  <div className="study-now-playing-name">
                    {currentStation.name}
                  </div>
                  <div className="study-now-playing-status">
                    {isPlaying ? '▶ Playing' : '⏸ Paused'}
                  </div>
                </div>
              </div>
              <button
                className="study-playpause-btn"
                onClick={handlePlayPause}
                style={{ background: currentStation.color }}
              >
                {isPlaying ? '⏸' : '▶'}
              </button>
            </div>
          )}

          {/* Volume */}
          <div className="study-volume-row">
            <span>🔈</span>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={e => setVolume(e.target.value)}
              className="study-volume-slider"
            />
            <span>🔊</span>
          </div>

          {/* Stations */}
          <div className="study-stations">
            {stations.map(station => (
              <button
                key={station.id}
                className={"study-station-btn " + (currentStation?.id === station.id ? 'active' : '')}
                onClick={() => handleStationSelect(station)}
                style={currentStation?.id === station.id ? {
                  borderColor: station.color,
                  background: station.color + '15'
                } : {}}
              >
                <span className="study-station-emoji">{station.emoji}</span>
                <span className="study-station-name">{station.name}</span>
                {currentStation?.id === station.id && isPlaying && (
                  <div className="study-station-playing">
                    <span /><span /><span />
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Hidden YouTube iframe */}
          {currentStation && isPlaying && (
            <iframe
              ref={iframeRef}
              src={getYouTubeUrl(currentStation)}
              style={{ display: 'none' }}
              allow="autoplay"
              title="Study Music"
            />
          )}

          <p className="study-mode-credit">
            Powered by YouTube • Audio only
          </p>
        </div>
      )}

    </div>
  );
};

export default StudyMode;