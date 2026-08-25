// src/components/UnifiedMessaging/LiveAudioPanel.js
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
  useLocalParticipant,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const LIVEKIT_URL = 'wss://vaibes-s8oidlpy.livekit.cloud';

const LiveAudioPanel = ({ group, autoStart = false }) => {
  const { user } = useAuth();
  const [session, setSession] = useState(null);
  const [token, setToken] = useState(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connectError, setConnectError] = useState(null);

  const skipFetchRef = useRef(false);
  const intentionalDisconnectRef = useRef(false);
  const autoStartedRef = useRef(false);
  const markIntentionalDisconnect = () => {
    intentionalDisconnectRef.current = true;
    setTimeout(() => { intentionalDisconnectRef.current = false; }, 5000);
  };

  const fetchSession = useCallback(async () => {
    if (skipFetchRef.current) return;
    const { data, error } = await supabase
      .from('live_sessions')
      .select('*')
      .eq('group_id', group.id)
      .is('ended_at', null)
      .maybeSingle();
    if (error) { console.error('fetchSession error:', error); }
    if (!skipFetchRef.current) {
      setSession(data);
      setLoading(false);
    }
  }, [group.id]);

  useEffect(() => {
    fetchSession();
    const channel = supabase
      .channel(`live-session-${group.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_sessions', filter: `group_id=eq.${group.id}` }, fetchSession)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [group.id, fetchSession]);

  const getToken = async (roomName) => {
    const { data, error } = await supabase.functions.invoke('livekit-token', {
      body: { roomName, identity: user.id, name: user.user_metadata?.display_name || user.email },
    });
    if (error) { console.error('Token error:', error); return null; }
    return data.token;
  };

  const goLive = async () => {
    skipFetchRef.current = true;
    setConnectError(null);

    const roomName = `group-${group.id}`;
    const { data: newSession, error } = await supabase
      .from('live_sessions')
      .insert({
        group_id: group.id,
        host_id: user.id,
        room_token: roomName,
        status: 'live',
        started_at: new Date().toISOString(),
        title: `${group.name} — Live Session`,
      })
      .select()
      .single();

    if (error) {
      skipFetchRef.current = false;
      console.error('Insert error:', JSON.stringify(error, null, 2));
      alert(`Go Live failed: ${error.message || error.code}`);
      return;
    }

    const t = await getToken(roomName);
    if (!t) {
      skipFetchRef.current = false;
      await supabase.from('live_sessions').update({ ended_at: new Date().toISOString(), status: 'ended' }).eq('id', newSession.id);
      setConnectError('Could not get a session token — check the livekit-token function logs.');
      return;
    }

    setSession(newSession);
    setToken(t);
    setConnected(true);
    await supabase.from('live_participants').insert({ session_id: newSession.id, user_id: user.id });
  };

  const joinLive = async () => {
    if (!session) return;
    skipFetchRef.current = true;
    setConnectError(null);

    const t = await getToken(session.room_token);
    if (!t) { skipFetchRef.current = false; setConnectError('Could not get a session token — check the livekit-token function logs.'); return; }

    setToken(t);
    setConnected(true);
    await supabase.from('live_participants').upsert({ session_id: session.id, user_id: user.id });
  };

  // NEW — when the room is opened with intent 'audio', join or start the
  // session automatically instead of waiting for a manual click. Fires once
  // per mount, after we know whether a session already exists (loading false).
  useEffect(() => {
    if (!autoStart || autoStartedRef.current || loading || connected) return;
    autoStartedRef.current = true;
    if (session) joinLive(); else goLive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, loading, connected, session]);

  const leaveLive = async () => {
    markIntentionalDisconnect();
    if (session) {
      await supabase.from('live_participants').delete().match({ session_id: session.id, user_id: user.id });
    }
    setConnected(false);
    setToken(null);
    skipFetchRef.current = false;
    fetchSession();
  };

  // Works standalone — doesn't require being connected/joined first.
  // This is what fixes "no End button for an existing live session".
  const endLive = async () => {
    markIntentionalDisconnect();
    skipFetchRef.current = true;
    const sessionId = session?.id;

    setConnected(false);
    setToken(null);
    setSession(null);

    if (sessionId) {
      const { error } = await supabase
        .from('live_sessions')
        .update({ ended_at: new Date().toISOString(), status: 'ended' })
        .eq('id', sessionId);

      if (error) {
        console.error('End live error:', error);
        alert(`Failed to end session: ${error.message}`);
        skipFetchRef.current = false;
        intentionalDisconnectRef.current = false;
        fetchSession();
        return;
      }
      supabase.from('live_participants').delete().eq('session_id', sessionId);
    }
    skipFetchRef.current = false;
  };

  const handleDisconnected = useCallback(() => {
    if (intentionalDisconnectRef.current) {
      intentionalDisconnectRef.current = false;
      return;
    }
    setConnected(false);
    setToken(null);
    skipFetchRef.current = false;
    fetchSession();
  }, [fetchSession]);

  if (loading) {
    return (
      <div className="icv-live-bar icv-live-loading">
        <span className="icv-live-status">Checking live status…</span>
      </div>
    );
  }

  if (connected && token) {
    return (
      <div className="icv-live-panel">
        <LiveKitRoom
          token={token}
          serverUrl={LIVEKIT_URL}
          connect={true}
          audio={true}
          video={false}
          onDisconnected={handleDisconnected}
          onError={(err) => {
            console.error('LiveKit connection error:', err);
            const msg = err?.message || '';
            let detail;
            if (/failed to fetch|could not establish signal/i.test(msg)) {
              detail = 'Could not reach the LiveKit server. Check that your LiveKit Cloud project is active (free projects auto-pause when idle), that the URL matches your dashboard, and check for ad-blockers/VPNs.';
            } else if (/permission|notallowed/i.test(msg)) {
              detail = 'Microphone permission was blocked. Allow mic access and try again.';
            } else {
              detail = msg ? `(${msg})` : 'Please try again.';
            }
            setConnectError(`Audio connection failed. ${detail}`);
            markIntentionalDisconnect();
            setConnected(false);
            setToken(null);
            if (session?.host_id === user.id) {
              supabase.from('live_sessions').update({ ended_at: new Date().toISOString(), status: 'ended' }).eq('id', session.id);
              setSession(null);
            }
            skipFetchRef.current = false;
          }}
        >
          <RoomAudioRenderer />
          <LiveControls
            isHost={session?.host_id === user.id}
            onLeave={leaveLive}
            onEnd={endLive}
          />
        </LiveKitRoom>
      </div>
    );
  }

  return (
    <div className="icv-live-bar">
      {connectError && <span className="msg-live-error">{connectError}</span>}
      {session ? (
        <>
          <span className="icv-live-status">
            <span className="icv-live-dot-pulse" /> Live audio session active
          </span>
          <div className="icv-live-controls">
            <button className="icv-product-cta" onClick={joinLive}>Join Live</button>
            {session.host_id === user.id && (
              <button className="icv-product-cta icv-end-btn" onClick={endLive}>End for everyone</button>
            )}
          </div>
        </>
      ) : (
        <button className="icv-product-cta icv-golive-btn" onClick={goLive}>🎙️ Go Live</button>
      )}
    </div>
  );
};

const LiveControls = ({ isHost, onLeave, onEnd }) => {
  const participants = useParticipants();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const toggleMic = () => localParticipant?.setMicrophoneEnabled(!isMicrophoneEnabled);

  return (
    <div className="icv-live-bar icv-live-bar-active">
      <span className="icv-live-status">
        <span className="icv-live-dot-pulse" /> Live · {participants.length} in room
      </span>
      <div className="icv-live-controls">
        <button
          className={`icv-product-cta msg-mic-btn ${isMicrophoneEnabled ? '' : 'muted'}`}
          onClick={toggleMic}
          title={isMicrophoneEnabled ? 'Mute mic' : 'Unmute mic'}
        >
          {isMicrophoneEnabled ? '🎙️ On' : '🔇 Muted'}
        </button>
        <button className="icv-product-cta icv-leave-btn" onClick={onLeave}>Leave</button>
        {isHost && (
          <button className="icv-product-cta icv-end-btn" onClick={onEnd}>End for everyone</button>
        )}
      </div>
    </div>
  );
};

export default LiveAudioPanel;