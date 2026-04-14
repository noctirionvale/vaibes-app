import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const stations = [
  { id: 'lofi', name: 'Lo-fi Hip Hop', emoji: '🎧', color: '#6a5cff', youtubeId: 'BCxTQq0UiFs' },
  { id: 'ambient', name: 'Ambient Nature', emoji: '🌿', color: '#10b981', youtubeId: 'DRFHklnN-SM' },
  { id: 'jazz', name: 'Jazz Cafe', emoji: '☕', color: '#d97706', youtubeId: 'MYPVQccHhAQ' },
  { id: 'focus', name: 'Deep Focus', emoji: '🧠', color: '#8b5cf6', youtubeId: 'oPVte6aMprI' },
  { id: 'classical', name: 'Classical', emoji: '🎻', color: '#ec4899', youtubeId: 'mIYzp5rcTvU' },
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

const StudyMode = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStation, setCurrentStation] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(50);
  const [customYoutubeUrl, setCustomYoutubeUrl] = useState('');
  const iframeRef = useRef(null);

  // Lock body scroll when panel is open (mobile)
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Load saved station
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

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const getYouTubeUrl = (station) => {
    if (!station || !isPlaying) return '';
    return `https://www.youtube-nocookie.com/embed/${station.youtubeId}?autoplay=1&loop=1&playlist=${station.youtubeId}&controls=0&modestbranding=1&rel=0&showinfo=0&mute=0&volume=${volume}`;
  };

  // --- Mobile styles (inline for clarity, but you can move to CSS file) ---
  const styles = {
    container: {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 1000,
    },
    toggleButton: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      background: '#1e1e2f',
      border: 'none',
      borderRadius: '40px',
      padding: '12px 20px',
      color: 'white',
      fontSize: '16px',
      fontWeight: '500',
      cursor: 'pointer',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      transition: 'all 0.2s ease',
    },
    panelOverlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: 1001,
      display: isOpen ? 'flex' : 'none',
      alignItems: 'flex-end',
    },
    panel: {
      backgroundColor: '#fff',
      width: '100%',
      maxHeight: '85vh',
      borderRadius: '24px 24px 0 0',
      padding: '20px',
      overflowY: 'auto',
      boxShadow: '0 -4px 20px rgba(0,0,0,0.2)',
      animation: 'slideUp 0.3s ease',
    },
    closeButton: {
      background: 'none',
      border: 'none',
      fontSize: '24px',
      position: 'absolute',
      top: '12px',
      right: '20px',
      cursor: 'pointer',
      padding: '8px',
    },
    currentRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '20px',
      padding: '12px',
      backgroundColor: '#f5f5f5',
      borderRadius: '16px',
    },
    playPauseBtn: {
      border: 'none',
      borderRadius: '40px',
      padding: '10px 20px',
      color: 'white',
      fontSize: '18px',
      cursor: 'pointer',
    },
    volumeRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      marginBottom: '20px',
    },
    volumeSlider: {
      flex: 1,
      height: '6px',
      borderRadius: '3px',
    },
    stationsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
      gap: '12px',
      marginBottom: '20px',
    },
    stationBtn: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '6px',
      padding: '12px',
      backgroundColor: '#f9f9f9',
      border: '1px solid #e0e0e0',
      borderRadius: '16px',
      cursor: 'pointer',
      transition: 'all 0.2s',
      fontSize: '14px',
    },
    customSection: {
      marginTop: '10px',
    },
    inputGroup: {
      display: 'flex',
      gap: '8px',
      marginTop: '8px',
    },
    youtubeInput: {
      flex: 1,
      padding: '12px',
      borderRadius: '40px',
      border: '1px solid #ccc',
      fontSize: '14px',
    },
    youtubeBtn: {
      padding: '12px 20px',
      borderRadius: '40px',
      border: 'none',
      backgroundColor: '#6a5cff',
      color: 'white',
      fontWeight: 'bold',
      cursor: 'pointer',
    },
    credit: {
      textAlign: 'center',
      fontSize: '12px',
      color: '#888',
      marginTop: '16px',
    },
  };

  return (
    <div style={styles.container}>
      {/* Toggle button */}
      <button
        style={styles.toggleButton}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{isPlaying ? '🎵' : '🎓'}</span>
        <span>Study Mode</span>
        {isPlaying && (
          <div className="study-mode-equalizer" style={{ display: 'flex', gap: '2px', marginLeft: '4px' }}>
            <span style={{ width: '3px', height: '10px', background: 'white', animation: 'pulse 1s infinite' }} />
            <span style={{ width: '3px', height: '14px', background: 'white', animation: 'pulse 1s infinite 0.2s' }} />
            <span style={{ width: '3px', height: '8px', background: 'white', animation: 'pulse 1s infinite 0.4s' }} />
          </div>
        )}
      </button>

      {/* Mobile bottom sheet overlay */}
      <div style={styles.panelOverlay} onClick={() => setIsOpen(false)}>
        <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
          <button style={styles.closeButton} onClick={() => setIsOpen(false)}>✕</button>

          {/* Current station row */}
          {currentStation && (
            <div style={styles.currentRow}>
              <span style={{ fontSize: '24px' }}>{currentStation.emoji}</span>
              <span style={{ fontWeight: 'bold', flex: 1, marginLeft: '12px' }}>{currentStation.name}</span>
              <button
                style={{ ...styles.playPauseBtn, backgroundColor: currentStation.color }}
                onClick={handlePlayPause}
              >
                {isPlaying ? '⏸' : '▶'}
              </button>
            </div>
          )}

          {/* Volume control */}
          <div style={styles.volumeRow}>
            <span>🔈</span>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={e => setVolume(Number(e.target.value))}
              style={styles.volumeSlider}
            />
            <span>🔊</span>
          </div>

          {/* Stations grid */}
          <div style={styles.stationsGrid}>
            {stations.map(station => (
              <button
                key={station.id}
                style={{
                  ...styles.stationBtn,
                  borderColor: currentStation?.id === station.id ? station.color : '#e0e0e0',
                  backgroundColor: currentStation?.id === station.id ? `${station.color}15` : '#f9f9f9',
                }}
                onClick={() => handleStationSelect(station)}
              >
                <span style={{ fontSize: '28px' }}>{station.emoji}</span>
                <span>{station.name}</span>
                {currentStation?.id === station.id && isPlaying && (
                  <span style={{ fontSize: '10px', color: station.color }}>● Playing</span>
                )}
              </button>
            ))}
          </div>

          {/* Custom YouTube */}
          <div style={styles.customSection}>
            <div style={{ fontWeight: '500', marginBottom: '8px' }}>📺 Custom YouTube</div>
            <div style={styles.inputGroup}>
              <input
                type="text"
                placeholder="Paste YouTube URL"
                value={customYoutubeUrl}
                onChange={(e) => setCustomYoutubeUrl(e.target.value)}
                style={styles.youtubeInput}
              />
              <button onClick={handleCustomYoutube} style={styles.youtubeBtn}>
                🎵 Play
              </button>
            </div>
          </div>

          <p style={styles.credit}>Powered by YouTube</p>
        </div>
      </div>

      {/* Hidden iframe for audio */}
      {currentStation && isPlaying && (
        <iframe
          ref={iframeRef}
          src={getYouTubeUrl(currentStation)}
          style={{ display: 'none' }}
          allow="autoplay"
          title="Study Music"
        />
      )}

      {/* Simple keyframes for equalizer animation */}
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.4; transform: scaleY(0.8); }
          50% { opacity: 1; transform: scaleY(1); }
        }
        .study-mode-equalizer span {
          animation: pulse 1s infinite;
        }
        /* For touch devices, increase tap highlight */
        button {
          touch-action: manipulation;
        }
      `}</style>
    </div>
  );
};

export default StudyMode;