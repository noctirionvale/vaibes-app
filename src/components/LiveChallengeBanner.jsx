import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import QuizArenaModal from './QuizArenaModal';
import './LiveChallengeBanner.css';

const attachHostNames = async (rooms) => {
  if (rooms.length === 0) return [];
  const hostIds = [...new Set(rooms.map(r => r.host_id || r.creator_id).filter(Boolean))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', hostIds);
  const byId = Object.fromEntries((profiles || []).map(p => [p.id, p]));
  return rooms.map(r => ({
    ...r,
    hostName: byId[r.host_id || r.creator_id]?.display_name || 'Someone',
    hostAvatar: byId[r.host_id || r.creator_id]?.avatar_url || null,
  }));
};

// onJoinRoom: optional callback(roomId) — pass your existing setArenaRoomId
// (or mobile onOpenRacePlay) so this reuses whatever modal you already open
// elsewhere. If omitted, it falls back to managing its own QuizArenaModal,
// same "hybrid" pattern already used in CommunityBody for desktop.
const LiveChallengeBanner = ({ onJoinRoom }) => {
  const [liveRooms, setLiveRooms] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [fallbackRoomId, setFallbackRoomId] = useState(null);
  const seenIds = useRef(new Set());
  const hasLoadedOnce = useRef(false);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const pushToast = useCallback((room) => {
    setToasts(prev => [...prev, room]);
    setTimeout(() => dismissToast(room.id), 8000);
  }, [dismissToast]);

  const loadLiveRooms = useCallback(async () => {
    const { data, error } = await supabase
      .from('community_rooms')
      .select('id, title, subject, difficulty, max_players, host_id, creator_id, started_at')
      .eq('room_mode', 'race')
      .eq('status', 'live')
      .eq('show_in_banner', true)
      .order('started_at', { ascending: false });
    if (error || !data) return;

    const withHosts = await attachHostNames(data);
    setLiveRooms(withHosts);
    withHosts.forEach(r => seenIds.current.add(r.id));
    hasLoadedOnce.current = true;
  }, []);

  useEffect(() => {
    loadLiveRooms();

    // One shared channel, filtered server-side to race rooms only — every
    // client browsing EduFeed hears about every new/ended challenge in
    // real time, no polling.
    const channel = supabase
      .channel('live-quiz-challenges')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'community_rooms', filter: 'room_mode=eq.race'
      }, async payload => {
        const room = payload.new;
        if (room.status !== 'live' || !room.show_in_banner) return;
        const [withHost] = await attachHostNames([room]);

        setLiveRooms(prev => prev.some(r => r.id === room.id) ? prev : [withHost, ...prev]);

        // Only flash a toast for challenges that appear AFTER our first load —
        // otherwise every visitor gets toast-spammed for rooms that were
        // already live before they even opened the page.
        if (hasLoadedOnce.current && !seenIds.current.has(room.id)) {
          pushToast(withHost);
        }
        seenIds.current.add(room.id);
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'community_rooms', filter: 'room_mode=eq.race'
      }, async payload => {
       const room = payload.new;
       const shouldShow = room.status === 'live' && room.show_in_banner;

       if (!shouldShow) {
  setLiveRooms(prev => prev.filter(r => r.id !== room.id));
  setToasts(prev => prev.filter(t => t.id !== room.id));  // ← add this
  return;
}

       // Already tracked (e.g. title/subject edited) — just refresh its fields in place
       let alreadyTracked = false;
       setLiveRooms(prev => {
         alreadyTracked = prev.some(r => r.id === room.id);
         return alreadyTracked ? prev.map(r => r.id === room.id ? { ...r, ...room } : r) : prev;
       });

       // Banner toggle just switched back on — add it fresh
       if (!alreadyTracked) {
         const [withHost] = await attachHostNames([room]);
         setLiveRooms(prev => prev.some(r => r.id === room.id) ? prev : [withHost, ...prev]);
         if (hasLoadedOnce.current && !seenIds.current.has(room.id)) pushToast(withHost);
         seenIds.current.add(room.id);
       }
     })
     .on('postgres_changes', {
       event: 'DELETE', schema: 'public', table: 'community_rooms'
     }, payload => {
       const deletedId = payload.old?.id;
       if (!deletedId) return;
       setLiveRooms(prev => prev.filter(r => r.id !== deletedId));
       setToasts(prev => prev.filter(t => t.id !== deletedId));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadLiveRooms, pushToast]);

  const handleJoin = (roomId) => {
    if (onJoinRoom) onJoinRoom(roomId);
    else setFallbackRoomId(roomId);
    dismissToast(roomId);
  };

  return (
    <>
      {liveRooms.length > 0 && (
        <div className="lcb-ticker">
          <div className="lcb-ticker-track">
            {[...liveRooms, ...liveRooms].map((r, i) => (
              <button key={`${r.id}-${i}`} className="lcb-item" onClick={() => handleJoin(r.id)}>
                <span className="lcb-pulse-dot" />
                <span className="lcb-label">Live Challenge</span>
                <span className="lcb-sep">·</span>
                <span className="lcb-title">{r.title}</span>
                <span className="lcb-sep">·</span>
                <span className="lcb-host">by {r.hostName}</span>
                <span className="lcb-cta">Join Now →</span>
                <span className="lcb-gap">✦</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {toasts.length > 0 && createPortal(
        <div className="lcb-toast-stack">
          {toasts.map(t => (
            <div key={t.id} className="lcb-toast">
              <button className="lcb-toast-close" onClick={() => dismissToast(t.id)}>✕</button>
              <div className="lcb-toast-icon">🚨</div>
              <div className="lcb-toast-body">
                <div className="lcb-toast-title">New Live Challenge!</div>
                <div className="lcb-toast-text">
                  <strong>{t.hostName}</strong> just started <strong>"{t.title}"</strong>
                  {t.subject ? ` — ${t.subject}` : ''}
                </div>
                <button className="lcb-toast-join" onClick={() => handleJoin(t.id)}>🎮 Join Now</button>
              </div>
              <div className="lcb-toast-progress" />
            </div>
          ))}
        </div>,
        document.body
      )}

      {!onJoinRoom && fallbackRoomId && (
        <QuizArenaModal roomId={fallbackRoomId} onClose={() => setFallbackRoomId(null)} />
      )}
    </>
  );
};

export default LiveChallengeBanner;