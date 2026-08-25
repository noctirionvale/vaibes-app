// src/context/MusicPlayerContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

// Self-hosted — Pixabay hotlinking violates their ToS, so download these
// from pixabay.com/music/search/<mood>/ and drop them in public/audio/
// under these exact filenames (see download list at the end of this answer).
const STORAGE_BUCKET = 'study-music';

const getAudioUrl = (filename) => {
  const { data } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(`stations/${filename}`);
  return data?.publicUrl || null;
};

const stations = [
  { id: 'lofi',      name: 'Lo-fi',     emoji: '🎧', color: '#6a5cff', type: 'audio', src: getAudioUrl('lofi.mp3') },
  { id: 'ambient',   name: 'Nature',    emoji: '🌿', color: '#10b981', type: 'audio', src: getAudioUrl('nature.mp3') },
  { id: 'jazz',      name: 'Jazz',      emoji: '☕', color: '#d97706', type: 'audio', src: getAudioUrl('jazz.mp3') },
  { id: 'focus',     name: 'Focus',     emoji: '🧠', color: '#8b5cf6', type: 'audio', src: getAudioUrl('focus.mp3') },
  { id: 'classical', name: 'Classical', emoji: '🎻', color: '#ec4899', type: 'audio', src: getAudioUrl('classical.mp3') },
  { id: 'relax',     name: 'Relax',     emoji: '🌧️', color: '#00e5ff', type: 'audio', src: getAudioUrl('relax.mp3') },
];

const extractYoutubeId = (url) => {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*&v=([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
  return null;
};

const MusicPlayerContext = createContext(null);

export const MusicPlayerProvider = ({ children }) => {
  const { user } = useAuth();
  const [currentStation, setCurrentStation] = useState(null);
  const [isPlaying, setIsPlayingState] = useState(false);
  const [stationIdx, setStationIdx] = useState(0);
  const [volume, setVolumeState] = useState(70);

  // 'loop' (repeat current track forever — original default behavior) or
  // 'autonext' (advance to the next station when the current one ends).
  const [playbackMode, setPlaybackModeState] = useState(() => {
    try { return localStorage.getItem('vaibes_playback_mode') || 'loop'; }
    catch { return 'loop'; }
  });

  const setPlaybackMode = useCallback((mode) => {
    setPlaybackModeState(mode);
    try { localStorage.setItem('vaibes_playback_mode', mode); } catch {}
  }, []);

  const audioRef = useRef(null);
  const ytPlayerRef = useRef(null); // attached to the visible iframe in StudyWidget

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('user_preferences')
          .select('study_song_audio_url')
          .eq('user_id', user.id)
          .maybeSingle();
        const saved = stations.find(s => s.id === data?.study_song_audio_url);
        if (saved) { setCurrentStation(saved); setStationIdx(stations.indexOf(saved)); }
      } catch (e) { console.error(e); }
    })();
  }, [user?.id]);

  const savePreference = useCallback(async (stationId) => {
    if (!user) return;
    try {
      await supabase.from('user_preferences').upsert(
        { user_id: user.id, study_song_audio_url: stationId, study_song_type: 'audio', updated_at: new Date() },
        { onConflict: 'user_id' }
      );
    } catch (e) { console.error(e); }
  }, [user]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100;
    ytPlayerRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func: 'setVolume', args: [volume] }), '*'
    );
  }, [volume]);

  const setVolume = useCallback((v) => setVolumeState(v), []);

  const setIsPlaying = useCallback((value) => {
    setIsPlayingState(prev => {
      const next = typeof value === 'function' ? value(prev) : value;
      if (currentStation?.type === 'youtube') {
        ytPlayerRef.current?.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: next ? 'playVideo' : 'pauseVideo' }), '*'
        );
      } else if (audioRef.current) {
        next ? audioRef.current.play().catch(() => {}) : audioRef.current.pause();
      }
      return next;
    });
  }, [currentStation]);

  const stop = useCallback(() => {
    if (currentStation?.type === 'youtube') {
      ytPlayerRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: 'pauseVideo' }), '*'
      );
    } else {
      audioRef.current?.pause();
    }
    setIsPlayingState(false);
    setCurrentStation(null);
  }, [currentStation]);

  const selectStation = useCallback((station) => {
    if (currentStation?.id === station.id) { setIsPlaying(p => !p); return; }
    const idx = stations.findIndex(s => s.id === station.id);
    setCurrentStation(station);
    if (idx >= 0) setStationIdx(idx);
    setIsPlayingState(true);
    if (audioRef.current) {
      audioRef.current.src = station.src;
      audioRef.current.play().catch(() => {});
    }
    savePreference(station.id);
  }, [currentStation, setIsPlaying, savePreference]);

  const prevStation = useCallback(() => {
    selectStation(stations[(stationIdx - 1 + stations.length) % stations.length]);
  }, [stationIdx, selectStation]);

  const nextStation = useCallback(() => {
    selectStation(stations[(stationIdx + 1) % stations.length]);
  }, [stationIdx, selectStation]);

  // Opt-in only. Always a real, visible iframe — never hidden offscreen.
  const playCustomUrl = useCallback((url) => {
    const videoId = extractYoutubeId(url);
    if (!videoId) return false;
    audioRef.current?.pause();
    setCurrentStation({
      id: 'custom', name: url.length > 28 ? url.slice(0, 28) + '…' : url,
      emoji: '📺', color: '#6a5cff', type: 'youtube', youtubeId: videoId,
    });
    setIsPlayingState(true);
    return true;
  }, []);

  const embedUrl = currentStation?.type === 'youtube'
    ? `https://www.youtube-nocookie.com/embed/${currentStation.youtubeId}` +
      `?enablejsapi=1&autoplay=1&loop=${playbackMode === 'loop' ? 1 : 0}` +
      `&playlist=${currentStation.youtubeId}` +
      `&playsinline=1&rel=0&origin=${encodeURIComponent(window.location.origin)}`
    : '';

  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentStation) return;
    navigator.mediaSession.metadata = new window.MediaMetadata({
      title: currentStation.name, artist: 'vAIbes Study Session',
    });
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    navigator.mediaSession.setActionHandler('play', () => setIsPlaying(true));
    navigator.mediaSession.setActionHandler('pause', () => setIsPlaying(false));
    navigator.mediaSession.setActionHandler('stop', stop);
    navigator.mediaSession.setActionHandler('previoustrack', currentStation.type === 'audio' ? prevStation : null);
    navigator.mediaSession.setActionHandler('nexttrack', currentStation.type === 'audio' ? nextStation : null);
  }, [currentStation, isPlaying, setIsPlaying, stop, prevStation, nextStation]);

  const value = {
    stations, currentStation, isPlaying, stationIdx, volume,
    setIsPlaying, setVolume, selectStation, prevStation, nextStation,
    playCustomUrl, embedUrl, ytPlayerRef, stop,
    playbackMode, setPlaybackMode,
  };

  return (
    <MusicPlayerContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        loop={playbackMode === 'loop'}
        preload="none"
        style={{ display: 'none' }}
        onEnded={() => { if (playbackMode === 'autonext') nextStation(); }}
        onError={(e) => console.error('[MusicPlayer] failed to load', e.currentTarget.src)}
      />
    </MusicPlayerContext.Provider>
  );
};

export const useMusicPlayer = () => {
  const ctx = useContext(MusicPlayerContext);
  if (!ctx) throw new Error('useMusicPlayer must be used within MusicPlayerProvider');
  return ctx;
};