// src/components/StudyWidget.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import VibeClock from './VibeClock';
import './StudyWidget.css';

const formatStudyTime = (total) => {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`;
};

const StudyWidget = ({ userTier = 'free' }) => {
  const isPro = userTier === 'pro';

  const {
    stations, currentStation, isPlaying,
    setIsPlaying, selectStation, prevStation, nextStation, playCustomUrl,
    volume, setVolume, embedUrl, ytPlayerRef, stop,
    playbackMode, setPlaybackMode,
  } = useMusicPlayer();

  const [customUrl, setCustomUrl] = useState('');
  const [showClock, setShowClock] = useState(true);
  const videoRef = useRef(null);
  const canvasRef = useRef(null); // hidden canvas used only for snapshot capture

const [cameraActive, setCameraActive] = useState(false);
const [cameraStream, setCameraStream] = useState(null);
const [cameraDevices, setCameraDevices] = useState([]);
const [activeDeviceId, setActiveDeviceId] = useState(null);
const [mirrorEnabled, setMirrorEnabled] = useState(true);
const [snapshotFlash, setSnapshotFlash] = useState(false);

  // ── Gesture + playback settings ──
  const [gesturesEnabled, setGesturesEnabled] = useState(() => {
    try { return localStorage.getItem('vaibes_gestures_enabled') !== 'off'; }
    catch { return true; }
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsPos, setSettingsPos] = useState({ top: 0, left: 0 });
  const settingsBtnRef = useRef(null);
  const touchRef = useRef({ x: 0, y: 0, t: 0 });

  // ── Session timer (bonus gimmick) ──
  const [studySeconds, setStudySeconds] = useState(0);

  const isYoutube = currentStation?.type === 'youtube';

  const handleCustomPlay = () => {
    if (!playCustomUrl(customUrl)) { alert('Invalid YouTube URL'); return; }
    setCustomUrl('');
  };

  // Shared by open / device-switch / flip — always tears down the previous
// track before requesting a new one, and (re)builds the device list right
// after, since device labels are only populated post-permission.
const startCameraStream = async (constraints) => {
  const stream = await navigator.mediaDevices.getUserMedia({ video: constraints, audio: false });
  setCameraStream(prev => {
    prev?.getTracks().forEach(t => t.stop());
    return stream;
  });
  setCameraActive(true);

  try {
    const all = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = all.filter(d => d.kind === 'videoinput');
    setCameraDevices(videoInputs);
    const settings = stream.getVideoTracks()[0]?.getSettings() || {};
    setActiveDeviceId(settings.deviceId || videoInputs[0]?.deviceId || null);
    if (settings.facingMode) setMirrorEnabled(settings.facingMode !== 'environment');
  } catch {
    // Some browsers/permission states can reject enumerateDevices — camera
    // still works fine, it just won't offer a device switcher.
  }
};

const toggleCamera = async () => {
  if (cameraActive) {
    cameraStream?.getTracks().forEach(t => t.stop());
    setCameraStream(null);
    setCameraActive(false);
    setCameraDevices([]);
  } else {
    try { await startCameraStream(true); }
    catch (e) { alert('Camera access denied or unavailable.'); }
  }
};

const switchToDevice = async (deviceId) => {
  try { await startCameraStream({ deviceId: { exact: deviceId } }); }
  catch (e) { alert('Could not switch to that camera.'); }
};

// Front/back toggle for phones — reads whichever facingMode the current
// track reports and requests the opposite. Desktop webcams usually don't
// report a facingMode at all, so this just alerts gracefully there instead
// of pretending to switch to a camera that doesn't exist.
const flipCamera = async () => {
  const current = cameraStream?.getVideoTracks()[0]?.getSettings().facingMode;
  const next = current === 'environment' ? 'user' : 'environment';
  try { await startCameraStream({ facingMode: next }); }
  catch (e) { alert('No other camera found to switch to.'); }
};

const takeSnapshot = () => {
  const video = videoRef.current, canvas = canvasRef.current;
  if (!video || !canvas) return;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (mirrorEnabled) { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `study-snapshot-${Date.now()}.png`; a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
  setSnapshotFlash(true);
  setTimeout(() => setSnapshotFlash(false), 300);
};

  useEffect(() => {
    if (videoRef.current && cameraStream) videoRef.current.srcObject = cameraStream;
  }, [cameraStream]);

  useEffect(() => () => cameraStream?.getTracks().forEach(t => t.stop()), [cameraStream]);

  // Session timer: counts total time actually playing, resets on full stop
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => setStudySeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [isPlaying]);

  useEffect(() => { if (!currentStation) setStudySeconds(0); }, [currentStation]);

  const toggleGestures = () => {
    setGesturesEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem('vaibes_gestures_enabled', next ? 'on' : 'off'); } catch {}
      return next;
    });
  };

  // Settings popover uses fixed positioning (like VibeClock's alarm picker) —
  // `.study-widget` has overflow:hidden in pro/mobile modes, so a plain
  // absolute dropdown would get clipped.
  useEffect(() => {
    if (!settingsOpen) return;
    const recalc = () => {
      if (!settingsBtnRef.current) return;
      const rect = settingsBtnRef.current.getBoundingClientRect();
      setSettingsPos({ top: rect.bottom + 6, left: Math.max(8, rect.right - 190) });
    };
    recalc();
    window.addEventListener('scroll', recalc, true);
    window.addEventListener('resize', recalc);
    return () => {
      window.removeEventListener('scroll', recalc, true);
      window.removeEventListener('resize', recalc);
    };
  }, [settingsOpen]);

  useEffect(() => {
    if (!settingsOpen) return;
    const handleOutside = (e) => {
      if (!e.target.closest('.sw-settings-wrap') && !e.target.closest('.sw-settings-panel')) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [settingsOpen]);

  // Swipe left/right = next/prev station. Quick tap = play/pause.
  // Scoped to the disc area only, so mood-tile clicks are untouched.
  const handleTouchStart = (e) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };

  const handleTouchEnd = (e) => {
    if (!gesturesEnabled || stations.length < 2) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchRef.current.x;
    const dy = t.clientY - touchRef.current.y;
    const dt = Date.now() - touchRef.current.t;

    if (Math.abs(dx) > 42 && Math.abs(dy) < 40 && dt < 600) {
      dx < 0 ? nextStation() : prevStation();
    } else if (Math.abs(dx) < 12 && Math.abs(dy) < 12 && dt < 300) {
      if (!currentStation) selectStation(stations[0]); else setIsPlaying(p => !p);
    }
  };

  const activeColor = currentStation?.color || '#6a5cff';
  const stationName = currentStation?.name || 'Pick a station';

  const HeaderRow = () => (
    <div className="sw-header">
      <div className="sw-project-row">
        <span className="sw-project-label">Now Playing</span>
        <div className="sw-project-track">
          <span className="sw-track-name" style={{ color: isPlaying ? activeColor : undefined }}>
            {stationName}
          </span>
          {isPlaying && (
            <span className="sw-fav-badge" style={{ background: activeColor + '22', color: activeColor, borderColor: activeColor + '55' }}>
              LIVE
            </span>
          )}
          {studySeconds > 0 && (
            <span className="sw-session-badge" title="Time studied this session">
              ⏱ {formatStudyTime(studySeconds)}
            </span>
          )}
        </div>
      </div>

      <div className="sw-header-controls">
        <button
          className={`sw-icon-btn ${isPlaying ? 'sw-icon-active' : ''}`}
          onClick={() => setIsPlaying(p => !p)}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/>
            <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
          </svg>
        </button>

        <div className="sw-volume-wrap" title={`Volume ${volume}%`}>
          <input
            type="range" min="0" max="100" value={volume}
            onChange={e => setVolume(+e.target.value)}
            className="sw-volume-slider"
            style={{ '--vol-pct': `${volume}%` }}
          />
        </div>

        <div className="sw-settings-wrap">
          <button
            ref={settingsBtnRef}
            className={`sw-icon-btn ${settingsOpen ? 'sw-icon-active' : ''}`}
            onClick={() => setSettingsOpen(o => !o)}
            title="Playback settings"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="6" x2="20" y2="6"/>
              <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none"/>
              <line x1="4" y1="12" x2="20" y2="12"/>
              <circle cx="16" cy="12" r="2" fill="currentColor" stroke="none"/>
              <line x1="4" y1="18" x2="20" y2="18"/>
              <circle cx="11" cy="18" r="2" fill="currentColor" stroke="none"/>
            </svg>
          </button>

          {settingsOpen && (
            <div
              className="sw-settings-panel"
              style={{ position: 'fixed', top: settingsPos.top, left: settingsPos.left, zIndex: 9999 }}
            >
              <div className="sw-settings-row">
                <span>Swipe gestures</span>
                <button className={`sw-toggle-pill ${gesturesEnabled ? 'on' : ''}`} onClick={toggleGestures}>
                  {gesturesEnabled ? 'On' : 'Off'}
                </button>
              </div>
              <div className="sw-settings-row sw-settings-row--stack">
                <span>On track end</span>
                <div className="sw-segmented">
                  <button className={playbackMode === 'loop' ? 'active' : ''} onClick={() => setPlaybackMode('loop')}>
                    Loop
                  </button>
                  <button className={playbackMode === 'autonext' ? 'active' : ''} onClick={() => setPlaybackMode('autonext')}>
                    Auto-next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          className={`sw-icon-btn ${showClock ? 'sw-icon-active' : ''}`}
          onClick={() => setShowClock(s => !s)}
          title="Toggle clock"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </button>

        <button
          className={`sw-icon-btn ${cameraActive ? 'sw-icon-active sw-icon-danger' : ''}`}
          onClick={toggleCamera}
          title={cameraActive ? 'Stop camera' : 'Open camera'}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 7l-7 5 7 5V7z"/>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
          </svg>
        </button>
      </div>
    </div>
  );

  const PlayerCard = () => (
    <div className="sw-art-card">
      <div
        className="sw-art-left"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className={`sw-art-disc ${isPlaying ? 'sw-disc-spin' : ''}`}>
          <span>{currentStation?.emoji || '🎓'}</span>
          {isPlaying && <div className="sw-pulse" />}
        </div>
        <div className="sw-art-label">
          <span className="sw-art-track">{stationName}</span>
          <span className="sw-art-sub">{isPlaying ? 'Playing now' : 'Paused'}</span>
        </div>
      </div>

      <div className="sw-art-divider" />

      <div className="sw-art-right">
        {stations.map((s) => {
          const active = currentStation?.id === s.id;
          return (
            <button
              key={s.id}
              className={`sw-mood-tile ${active ? 'sw-mood-active' : ''}`}
              onClick={() => selectStation(s)}
              style={active
                ? { borderColor: s.color, background: s.color + '18', color: s.color }
                : undefined}
              title={s.name}
            >
              <span className="sw-mood-emoji">{s.emoji}</span>
              <span className="sw-mood-name">{s.name}</span>
              {active && isPlaying && (
                <div className="sw-mood-eq"><span /><span /><span /></div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  // Visible, ToS-compliant inline YouTube player. Replaces the old
  // offscreen mini player entirely — no hidden iframes, anywhere.
  const YoutubeCard = () => (
    <div className="sw-yt-card">
      <iframe
        ref={ytPlayerRef}
        key={currentStation.youtubeId}
        src={embedUrl}
        className="sw-yt-frame"
        allow="autoplay; encrypted-media"
        title={currentStation.name}
      />
      <div className="sw-yt-meta">
        <span className="sw-yt-name">{currentStation.name}</span>
        <button className="sw-yt-remove" onClick={stop} title="Remove and go back to stations">
          ✕ Remove
        </button>
      </div>
    </div>
  );

  const Controls = () => (
    <div className="sw-controls">
      {!isYoutube && (
        <button className="sw-ctrl-btn" onClick={prevStation} title="Previous">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="19 20 9 12 19 4 19 20"/>
            <line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" strokeWidth="2"/>
          </svg>
        </button>
      )}
      <button
        className="sw-play-btn"
        onClick={() => { if (!currentStation) selectStation(stations[0]); else setIsPlaying(p => !p); }}
        style={{ background: `linear-gradient(135deg, ${activeColor}, ${activeColor}bb)` }}
      >
        {isPlaying ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16"/>
            <rect x="14" y="4" width="4" height="16"/>
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
        )}
      </button>
      {!isYoutube && (
        <button className="sw-ctrl-btn" onClick={nextStation} title="Next">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 4 15 12 5 20 5 4"/>
            <line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="2"/>
          </svg>
        </button>
      )}
    </div>
  );

  const UploadRow = () => (
    <div className="sw-upload-row">
      <div className="sw-upload-bar">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.45">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <input
          type="text"
          placeholder="Or paste a YouTube link — plays as a small visible player"
          value={customUrl}
          onChange={e => setCustomUrl(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleCustomPlay(); }}
          className="sw-upload-input"
        />
        {customUrl && (
          <button className="sw-upload-play-btn" onClick={handleCustomPlay}>Play</button>
        )}
      </div>
    </div>
  );

  const CameraPreview = () => cameraActive && (
  <div className="sw-camera-preview">
    <video
      ref={videoRef}
      autoPlay muted playsInline
      className="sw-camera-video"
      style={{ transform: mirrorEnabled ? 'scaleX(-1)' : 'none' }}
    />
    <canvas ref={canvasRef} style={{ display: 'none' }} />
    {snapshotFlash && <div className="sw-camera-flash" />}

    <div className="sw-camera-toolbar">
      <button className="sw-camera-tool-btn" onClick={flipCamera} title="Flip camera">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 2.1l4 4-4 4"/><path d="M3 12.2v-2a4 4 0 0 1 4-4h12.8"/>
          <path d="M7 21.9l-4-4 4-4"/><path d="M21 11.8v2a4 4 0 0 1-4 4H4.2"/>
        </svg>
      </button>

      <button className="sw-camera-tool-btn" onClick={takeSnapshot} title="Take snapshot">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
      </button>

      {cameraDevices.length > 1 && (
        <select
          className="sw-camera-select"
          value={activeDeviceId || ''}
          onChange={e => switchToDevice(e.target.value)}
          title="Choose camera"
        >
          {cameraDevices.map((d, i) => (
            <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>
          ))}
        </select>
      )}

      <button
        className={`sw-camera-tool-btn ${mirrorEnabled ? 'sw-camera-tool-active' : ''}`}
        onClick={() => setMirrorEnabled(m => !m)}
        title={mirrorEnabled ? 'Mirror on' : 'Mirror off'}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="3" x2="12" y2="21"/>
          <polyline points="8 8 4 12 8 16"/><polyline points="16 8 20 12 16 16"/>
        </svg>
      </button>
    </div>

    <button className="sw-camera-close" onClick={toggleCamera}>✕</button>
  </div>
);

  if (!isPro) {
    return (
      <div className="study-widget study-widget--free">
        {HeaderRow()}
        {CameraPreview()}
        {showClock && (
          <div className="sw-clock-center"><VibeClock /></div>
        )}
        <div className="sw-player-stack">
          {isYoutube ? YoutubeCard() : PlayerCard()}
          {Controls()}
        </div>
        {UploadRow()}
      </div>
    );
  }

  return (
    <div className="study-widget">
      {HeaderRow()}
      {CameraPreview()}
      <div className="sw-body">
        {showClock && (
          <div className="sw-clock-col"><VibeClock /></div>
        )}
        <div className="sw-player-col">
          {isYoutube ? YoutubeCard() : PlayerCard()}
          {Controls()}
        </div>
      </div>
      {UploadRow()}
    </div>
  );
};

export default StudyWidget;