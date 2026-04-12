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
  const regex = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
};

const StudyMode = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStation, setCurrentStation] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [customYoutubeUrl, setCustomYoutubeUrl] = useState('');
  const iframeRef = useRef(null);

  // Keep audio context alive (hack to allow background playback)
  useEffect(() => {
    if (!isPlaying || !currentStation) return;
    let audioCtx;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = 0.001;
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start();
      }
    } catch (e) {}
    return () => {
      if (audioCtx) audioCtx.close();
    };
  }, [isPlaying, currentStation]);

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
            setIsPlaying(true);
          } else {
            setCurrentStation({
              id: 'custom',
              name: 'Custom YouTube',
              emoji: '📺',
              color: '#6a5cff',
              youtubeId: data.study_song_audio_url,
            });
            setIsPlaying(true);
          }
        }
      } catch (err) {}
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
    } catch (err) {}
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

  // Fixed volume at 50 – no slider, so src never changes unnecessarily
  const getYouTubeUrl = (station) => {
    if (!station || !isPlaying) return '';
    return `https://www.youtube-nocookie.com/embed/${station.youtubeId}?autoplay=1&loop=1&playlist=${station.youtubeId}&controls=0&modestbranding=1&rel=0&showinfo=0&mute=0&volume=50`;
  };

  return (
    <div className="study-mode-container">
      <button
        className={`study-mode-toggle ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="study-mode-icon">{isPlaying ? '🎵' : '🎓'}</span>
        <span className="study-mode-label">Study Mode</span>
        {isPlaying && (
          <div className="study-mode-equalizer">
            <span /><span /><span /><span />
          </div>
        )}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }}>
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      <div className="study-mode-panel" style={{ display: isOpen ? 'flex' : 'none' }}>
        {currentStation && (
          <div className="study-current-row">
            <span className="study-current-emoji">{currentStation.emoji}</span>
            <span className="study-current-name">{currentStation.name}</span>
            <button className="study-playpause-btn" onClick={handlePlayPause} style={{ background: currentStation.color }}>
              {isPlaying ? '⏸' : '▶'}
            </button>
          </div>
        )}

        <div className="study-stations">
          {stations.map(station => (
            <button
              key={station.id}
              className={`study-station-btn ${currentStation?.id === station.id ? 'active' : ''}`}
              onClick={() => handleStationSelect(station)}
              style={currentStation?.id === station.id ? { borderColor: station.color, background: `${station.color}15` } : {}}
            >
              <span className="study-station-emoji">{station.emoji}</span>
              <span className="study-station-name">{station.name}</span>
              {currentStation?.id === station.id && isPlaying && (
                <div className="study-station-playing"><span /><span /><span /></div>
              )}
            </button>
          ))}
        </div>

        <div className="study-custom-youtube">
          <div className="study-section-label">📺 Custom YouTube</div>
          <div className="study-youtube-input-group">
            <input
              type="text"
              placeholder="Paste YouTube URL"
              value={customYoutubeUrl}
              onChange={(e) => setCustomYoutubeUrl(e.target.value)}
              className="study-youtube-input"
            />
            <button onClick={handleCustomYoutube} className="study-youtube-btn">
              🎵 Play
            </button>
          </div>
        </div>

        <p className="study-mode-credit">Powered by YouTube</p>
      </div>

      {currentStation && isPlaying && (
        <iframe
          key={currentStation.id} // ensures iframe re-creates only when station changes
          ref={iframeRef}
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