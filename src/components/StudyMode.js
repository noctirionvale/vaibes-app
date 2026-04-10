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
  const [volume, setVolume] = useState(50);
  const iframeRef = useRef(null);
  const audioRef = useRef(null);

  const [localAudioUrl, setLocalAudioUrl] = useState(null);
  const [localFileName, setLocalFileName] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [customYoutubeUrl, setCustomYoutubeUrl] = useState('');

  // ✅ Fixed: depends only on user?.id, no useCallback, no infinite loop
  useEffect(() => {
    if (!user?.id) return;

    const fetchPreference = async () => {
      try {
        const { data, error } = await supabase
          .from('user_preferences')
          .select('study_song_audio_url, study_song_type')
          .eq('user_id', user.id)
          .maybeSingle();   // ✅ returns null instead of 406

        if (error) throw error;
        if (!data) return;  // no preferences saved yet

        if (data.study_song_type === 'local' && data.study_song_audio_url) {
          setLocalAudioUrl(data.study_song_audio_url);
          setLocalFileName('Saved Song');
          setCurrentStation(null);
          setIsPlaying(true);
        } else if (data.study_song_type === 'youtube' && data.study_song_audio_url) {
          const savedStation = stations.find(s => s.youtubeId === data.study_song_audio_url);
          if (savedStation) {
            setCurrentStation(savedStation);
          } else {
            setCurrentStation({
              id: 'custom',
              name: 'Custom YouTube',
              emoji: '📺',
              color: '#6a5cff',
              youtubeId: data.study_song_audio_url,
            });
          }
          setIsPlaying(true);
        }
      } catch (err) {
        console.error('Failed to load study preference:', err.message);
      }
    };

    fetchPreference();
  }, [user?.id]);   // ✅ only runs when the actual user ID changes

  const savePreference = async (audioUrl, type) => {
    if (!user) return;
    await supabase.from('user_preferences').upsert({
      user_id: user.id,
      study_song_audio_url: audioUrl,
      study_song_type: type,
      updated_at: new Date(),
    });
  };

  const handleStationSelect = (station) => {
    if (currentStation?.id === station.id && isPlaying) {
      setIsPlaying(false);
      return;
    }
    if (localAudioUrl) {
      setLocalAudioUrl(null);
      setLocalFileName(null);
      if (audioRef.current) audioRef.current.pause();
    }
    setCurrentStation(station);
    setIsPlaying(true);
    savePreference(station.youtubeId, 'youtube');
  };

  const handleCustomYoutube = async () => {
    const videoId = extractYoutubeId(customYoutubeUrl);
    if (!videoId) {
      alert('Invalid YouTube URL. Please check and try again.');
      return;
    }
    if (localAudioUrl) {
      setLocalAudioUrl(null);
      setLocalFileName(null);
      if (audioRef.current) audioRef.current.pause();
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
    await savePreference(videoId, 'youtube');
    setCustomYoutubeUrl('');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      alert('Please select an audio file (MP3, WAV, OGG, etc.)');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      alert('File too large (max 20MB)');
      return;
    }
    setUploading(true);
    try {
      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('user_audio')
        .upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('user_audio').getPublicUrl(filePath);
      setLocalAudioUrl(publicUrl);
      setLocalFileName(file.name);
      setCurrentStation(null);
      setIsPlaying(true);
      await savePreference(publicUrl, 'local');
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handlePlayPause = () => {
    if (localAudioUrl && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
    } else if (currentStation) {
      setIsPlaying(!isPlaying);
    }
    setIsPlaying(!isPlaying);
  };

  const getYouTubeUrl = (station) => {
    if (!station || !isPlaying) return '';
    return `https://www.youtube-nocookie.com/embed/${station.youtubeId}?autoplay=1&loop=1&playlist=${station.youtubeId}&controls=0&modestbranding=1&rel=0&showinfo=0&mute=0&volume=${volume}`;
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  useEffect(() => {
    return () => {
      if (localAudioUrl && localAudioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(localAudioUrl);
      }
    };
  }, [localAudioUrl]);

  return (
    <div className="study-mode-container">
      <button
        className={"study-mode-toggle " + (isOpen ? 'active' : '')}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="study-mode-icon">{isPlaying ? '🎵' : '🎓'}</span>
        <div className="study-mode-toggle-text">
          <span className="study-mode-label">Study Mode</span>
          <span className="study-mode-sublabel">
            {isPlaying && (currentStation ? currentStation.emoji + ' ' + currentStation.name : (localFileName ? '📁 ' + localFileName : 'Paused'))}
          </span>
        </div>
        {isPlaying && (
          <div className="study-mode-equalizer">
            <span /><span /><span /><span />
          </div>
        )}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease', flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      <div className="study-mode-panel" style={{ display: isOpen ? 'flex' : 'none' }}>
        {(currentStation || localAudioUrl) && (
          <div className="study-now-playing" style={{ borderColor: currentStation ? currentStation.color + '40' : '#6a5cff' }}>
            <div className="study-now-playing-info">
              <span className="study-now-playing-emoji">
                {localAudioUrl ? '📁' : currentStation?.emoji}
              </span>
              <div>
                <div className="study-now-playing-name">
                  {localAudioUrl ? localFileName : currentStation?.name}
                </div>
                <div className="study-now-playing-status">
                  {isPlaying ? '▶ Playing' : '⏸ Paused'}
                </div>
              </div>
            </div>
            <button className="study-playpause-btn" onClick={handlePlayPause} style={{ background: currentStation ? currentStation.color : '#6a5cff' }}>
              {isPlaying ? '⏸' : '▶'}
            </button>
          </div>
        )}

        <div className="study-volume-row">
          <span>🔈</span>
          <input type="range" min="0" max="100" value={volume} onChange={e => setVolume(e.target.value)} className="study-volume-slider" />
          <span>🔊</span>
        </div>

        <div className="study-stations">
          <div className="study-section-label">🎧 Recommended Stations</div>
          {stations.map(station => (
            <button
              key={station.id}
              className={"study-station-btn " + (currentStation?.id === station.id ? 'active' : '')}
              onClick={() => handleStationSelect(station)}
              style={currentStation?.id === station.id ? { borderColor: station.color, background: station.color + '15' } : {}}
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
              placeholder="Paste YouTube URL (e.g., https://youtu.be/...)"
              value={customYoutubeUrl}
              onChange={(e) => setCustomYoutubeUrl(e.target.value)}
              className="study-youtube-input"
            />
            <button onClick={handleCustomYoutube} className="study-youtube-btn">
              ➕ Use
            </button>
          </div>
        </div>

        <div className="study-upload-section">
          <div className="study-section-label">📁 Your Music</div>
          <label className="study-station-btn" style={{ cursor: uploading ? 'wait' : 'pointer', justifyContent: 'center' }}>
            <span className="study-station-emoji">📁</span>
            <span className="study-station-name">{uploading ? 'Uploading...' : 'Upload Audio'}</span>
            <input type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleFileUpload} disabled={uploading} />
          </label>
          {localAudioUrl && (
            <div className="study-local-file-info">
              Currently playing: {localFileName}
              <button onClick={() => {
                setLocalAudioUrl(null);
                setLocalFileName(null);
                if (audioRef.current) audioRef.current.pause();
                savePreference(null, null);
              }} style={{ marginLeft: '8px', background: 'none', border: 'none', cursor: 'pointer' }}>🗑</button>
            </div>
          )}
        </div>

        <p className="study-mode-credit">Powered by YouTube • Upload your own music</p>
      </div>

      {currentStation && isPlaying && !localAudioUrl && (
        <iframe ref={iframeRef} src={getYouTubeUrl(currentStation)} style={{ display: 'none' }} allow="autoplay" title="Study Music" />
      )}

      {localAudioUrl && (
        <audio ref={audioRef} src={localAudioUrl} autoPlay={isPlaying} loop style={{ display: 'none' }} />
      )}
    </div>
  );
};

export default StudyMode;