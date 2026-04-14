import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const stations = [
  { id: 'lofi', name: 'Lo-fi', emoji: '🎧', color: '#6a5cff', youtubeId: 'BCxTQq0UiFs' },
  { id: 'ambient', name: 'Nature', emoji: '🌿', color: '#10b981', youtubeId: 'DRFHklnN-SM' },
  { id: 'focus', name: 'Focus', emoji: '🧠', color: '#8b5cf6', youtubeId: 'oPVte6aMprI' },
  { id: 'jazz', name: 'Jazz', emoji: '☕', color: '#d97706', youtubeId: 'MYPVQccHhAQ' },
];

const extractYoutubeId = (url) => {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*&v=([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

const MobileStudyMode = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [currentStation, setCurrentStation] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(50);
  const [customYoutubeUrl, setCustomYoutubeUrl] = useState('');
  const iframeRef = useRef(null);

  // Load saved station from Supabase
  useEffect(() => {
    if (!user?.id) return;
    const fetchPreference = async () => {
      try {
        const { data, error } = await supabase
          .from('user_preferences')
          .select('study_song_audio_url')
          .eq('user_id', user.id)
          .maybeSingle();
        if (error) throw error;
        if (data?.study_song_audio_url) {
          const saved = stations.find(s => s.youtubeId === data.study_song_audio_url);
          if (saved) {
            setCurrentStation(saved);
          } else {
            // Custom YouTube video
            setCurrentStation({
              id: 'custom',
              name: 'Custom YouTube',
              emoji: '📺',
              color: '#6a5cff',
              youtubeId: data.study_song_audio_url,
            });
          }
        }
      } catch (err) {
        console.error("Failed to load preferences", err);
      }
    };
    fetchPreference();
  }, [user?.id]);

  // Save preference when station changes
  const savePreference = async (youtubeId) => {
    if (!user) return;
    try {
      await supabase.from('user_preferences').upsert(
        { user_id: user.id, study_song_audio_url: youtubeId, study_song_type: 'youtube', updated_at: new Date() },
        { onConflict: 'user_id' }
      );
    } catch (err) {
      console.error("Failed to save preference", err);
    }
  };

  // Handle station selection
  const handleStationClick = (station) => {
    if (currentStation?.id === station.id && isPlaying) {
      setIsPlaying(false);
    } else {
      setCurrentStation(station);
      setIsPlaying(true);
      savePreference(station.youtubeId);
    }
  };

  // Handle custom YouTube submission
  const handleCustomYoutube = () => {
    const videoId = extractYoutubeId(customYoutubeUrl);
    if (!videoId) {
      alert('Invalid YouTube URL');
      return;
    }
    const customStation = {
      id: 'custom',
      name: 'Custom YouTube',
      emoji: '📺',
      color: '#6a5cff',
      youtubeId: videoId,
    };
    setCurrentStation(customStation);
    setIsPlaying(true);
    savePreference(videoId);
    setCustomYoutubeUrl('');
  };

  // Update iframe src when volume changes (so YouTube respects new volume)
  useEffect(() => {
    if (!currentStation || !isPlaying) return;
    if (iframeRef.current) {
      const newSrc = `https://www.youtube-nocookie.com/embed/${currentStation.youtubeId}?autoplay=1&loop=1&playlist=${currentStation.youtubeId}&controls=0&modestbranding=1&rel=0&showinfo=0&mute=0&volume=${volume}`;
      iframeRef.current.src = newSrc;
    }
  }, [volume, currentStation, isPlaying]);

  // Build YouTube URL
  const getYouTubeUrl = (station) => {
    if (!station || !isPlaying) return '';
    return `https://www.youtube-nocookie.com/embed/${station.youtubeId}?autoplay=1&loop=1&playlist=${station.youtubeId}&controls=0&modestbranding=1&rel=0&showinfo=0&mute=0&volume=${volume}`;
  };

  return (
    <>
      {/* Hidden iframe – always present when playing, even when drawer is closed */}
      {currentStation && isPlaying && (
        <iframe
          ref={iframeRef}
          src={getYouTubeUrl(currentStation)}
          style={{ display: 'none' }}
          allow="autoplay"
          title="Study Music Background"
        />
      )}

      {/* Drawer UI – only visible when isOpen is true */}
      {isOpen && (
        <>
          <div className="mobile-drawer-overlay" onClick={onClose} />
          <div className="mobile-study-drawer">
            <div className="mobile-drawer-drag-handle" />
            
            <div className="mobile-drawer-header">
              <div className="header-title-group">
                <span className="header-status-dot" style={{ background: isPlaying ? '#10b981' : '#6b7280' }} />
                <h3>Study Sessions</h3>
              </div>
              <button className="mobile-drawer-close" onClick={onClose}>✕</button>
            </div>

            {/* Current station & play/pause */}
            {currentStation && (
              <div className="mobile-current-row">
                <span className="current-emoji">{currentStation.emoji}</span>
                <span className="current-name">{currentStation.name}</span>
                <button
                  className="mobile-playpause"
                  style={{ background: currentStation.color }}
                  onClick={() => setIsPlaying(!isPlaying)}
                >
                  {isPlaying ? '⏸' : '▶'}
                </button>
              </div>
            )}

            {/* Stations grid */}
            <div className="mobile-study-grid">
              {stations.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleStationClick(s)}
                  className={`mobile-station-tile ${currentStation?.id === s.id ? 'active' : ''}`}
                  style={currentStation?.id === s.id ? { '--accent': s.color } : {}}
                >
                  <span className="tile-emoji">{s.emoji}</span>
                  <span className="tile-name">{s.name}</span>
                  {currentStation?.id === s.id && isPlaying && (
                    <div className="mini-equalizer">
                      <span /><span /><span />
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Custom YouTube Section */}
            <div className="mobile-custom-youtube">
              <div className="custom-label">📺 Custom YouTube</div>
              <div className="custom-input-group">
                <input
                  type="text"
                  placeholder="Paste YouTube URL"
                  value={customYoutubeUrl}
                  onChange={(e) => setCustomYoutubeUrl(e.target.value)}
                  className="custom-youtube-input"
                />
                <button onClick={handleCustomYoutube} className="custom-play-btn">
                  🎵 Play
                </button>
              </div>
            </div>

            {/* Volume control */}
            <div className="mobile-volume-stack">
              <div className="volume-label">
                <span>Volume</span>
                <span>{volume}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={volume} 
                onChange={(e) => setVolume(Number(e.target.value))}
                className="mobile-volume-slider"
              />
            </div>

            <p className="mobile-credit">Powered by YouTube</p>
          </div>
        </>
      )}
    </>
  );
};

export default MobileStudyMode;