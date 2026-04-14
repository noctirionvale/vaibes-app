import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const stations = [
  { id: 'lofi', name: 'Lo-fi', emoji: '🎧', color: '#6a5cff', youtubeId: 'BCxTQq0UiFs' },
  { id: 'ambient', name: 'Nature', emoji: '🌿', color: '#10b981', youtubeId: 'DRFHklnN-SM' },
  { id: 'focus', name: 'Focus', emoji: '🧠', color: '#8b5cf6', youtubeId: 'oPVte6aMprI' },
  { id: 'jazz', name: 'Jazz', emoji: '☕', color: '#d97706', youtubeId: 'MYPVQccHhAQ' },
];

const MobileStudyMode = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [currentStation, setCurrentStation] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(50);
  const iframeRef = useRef(null);

  // Load preferences from Supabase
  useEffect(() => {
    if (!user?.id || !isOpen) return;

    const fetchPreference = async () => {
      try {
        const { data } = await supabase
          .from('user_preferences')
          .select('study_song_audio_url')
          .eq('user_id', user.id)
          .maybeSingle();

        if (data?.study_song_audio_url) {
          const saved = stations.find(s => s.youtubeId === data.study_song_audio_url);
          if (saved) setCurrentStation(saved);
        }
      } catch (err) {
        console.error("StudyMode: Load error", err);
      }
    };
    fetchPreference();
  }, [user?.id, isOpen]);

  const handleStationClick = (station) => {
    if (currentStation?.id === station.id) {
      setIsPlaying(!isPlaying);
    } else {
      setCurrentStation(station);
      setIsPlaying(true);
      // Optional: Save preference here
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Tap overlay to close */}
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
            onChange={(e) => setVolume(e.target.value)}
            className="mobile-volume-slider"
          />
        </div>

        {/* The Audio Engine (Hidden) */}
        {currentStation && isPlaying && (
          <iframe
            ref={iframeRef}
            src={`https://www.youtube-nocookie.com/embed/${currentStation.youtubeId}?autoplay=1&loop=1&playlist=${currentStation.youtubeId}&controls=0&mute=0`}
            style={{ display: 'none' }}
            allow="autoplay"
          />
        )}
      </div>
    </>
  );
};

export default MobileStudyMode;