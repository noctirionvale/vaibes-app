import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import './CommunityRoomPlay.css';
import useIsMobile from '../hooks/useIsMobile';

const MAX_ATTEMPTS = 3;
const GROUP_WINDOW_MS = 60000; // consecutive messages from same sender within 60s are visually grouped

// Buckets a chat row into a "kind" for the grouping check below. AI answers and AI
// hints both come from "Vaibey" and can share a group; every other message_type
// only groups with an identical type, so an 'answer' bubble can never visually
// swallow the header/badge of a following 'hint_request' bubble (or vice versa).
const typeGroup = (msg) => (msg.message_type === 'ai_response' || msg.message_type === 'ai_hint') ? 'ai' : msg.message_type;

// ─── Avatar ───────────────────────────────────────────────────────────────────
const Avatar = ({ url, name, size = 28 }) => {
  const initials = (name || '?')[0].toUpperCase();
  if (url) {
    return (
      <img
        className="crp-avatar"
        src={url}
        alt={name}
        style={{ width: size, height: size }}
        onError={e => { e.currentTarget.style.display = 'none'; }}
      />
    );
  }
  return (
    <div
      className="crp-avatar crp-avatar-initials"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {initials}
    </div>
  );
};

const CommunityRoomPlay = ({ roomId, onClose }) => {
  const { user, profile } = useAuth();

  const [room, setRoom] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [players, setPlayers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeCount, setActiveCount] = useState(0);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [isCheckingAnswer, setIsCheckingAnswer] = useState(false);
  const [winner, setWinner] = useState(null);
  const [sidebarTab, setSidebarTab] = useState('players');
  const [sendError, setSendError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [isLateJoiner, setIsLateJoiner] = useState(false); // opened an already-ended room, never actually played
  const [flashes, setFlashes] = useState({}); // { [user_id]: { delta } } — brief highlight when a score updates
  
  const isMobile = useIsMobile();
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const PAGE_SIZE = 200;

  const feedEndRef = useRef(null);
  const channelRef = useRef(null);
  const prevScoresRef = useRef({}); // last-seen score per user_id, used to detect increases for the flash effect

  const isHost = room?.current_host === user?.id || room?.creator_id === user?.id;
  const currentQuestion = questions[room?.current_question_index ?? 0];
  const myScore = players.find(p => p.user_id === user?.id)?.score ?? 0;

  const hasAnsweredCorrectly = useMemo(() => {
    return messages.some(m =>
      m.message_type === 'answer' &&
      m.user_id === user?.id &&
      m.question_id === currentQuestion?.id &&
      m.is_correct === true
    );
  }, [messages, user, currentQuestion?.id]);

  const myAttemptsUsed = useMemo(() => {
    // only WRONG answers consume a try — getting it right ends the round for you, it isn't a "used" attempt
    return messages.filter(m =>
      m.message_type === 'answer' &&
      m.user_id === user?.id &&
      m.question_id === currentQuestion?.id &&
      m.is_correct === false
    ).length;
  }, [messages, user, currentQuestion?.id]);

  const attemptsLeft = Math.max(0, MAX_ATTEMPTS - myAttemptsUsed);
  const timeUp = timeLeft === 0;

  // Answering is locked once: correct, out of tries, time's up, quiz ended, or an AI call is in flight
  const answerLocked = hasAnsweredCorrectly || attemptsLeft <= 0 || timeUp || room?.status === 'ended' || isAiTyping || isCheckingAnswer;

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [roomRes, questionsRes, playersRes, messagesRes] = await Promise.all([
        supabase.from('community_rooms').select('*').eq('id', roomId).single(),
        supabase.from('community_room_questions').select('*').eq('room_id', roomId).order('display_order'),
        supabase.from('community_room_players').select('*').eq('room_id', roomId).order('score', { ascending: false }),
        supabase
          .from('community_room_chat')
          .select('*, profiles(display_name, avatar_url)')
          .eq('room_id', roomId)
          .order('created_at', { ascending: false })
          .limit(PAGE_SIZE)
      ]);
      if (roomRes.data) setRoom(roomRes.data);
      if (questionsRes.data) setQuestions(questionsRes.data);
      if (playersRes.data) setPlayers(playersRes.data);
      if (messagesRes.data) {
        setMessages([...messagesRes.data].reverse());
        setHasMore(messagesRes.data.length === PAGE_SIZE);
      }
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  const loadOlderMessages = useCallback(async () => {
    if (loadingMore || !messages.length) return;
    setLoadingMore(true);
    try {
      const oldest = messages[0]?.created_at;
      const { data } = await supabase
        .from('community_room_chat')
        .select('*, profiles(display_name, avatar_url)')
        .eq('room_id', roomId)
        .lt('created_at', oldest)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);
      if (data) {
        setMessages(prev => [...[...data].reverse(), ...prev]);
        setHasMore(data.length === PAGE_SIZE);
      }
    } catch (err) {
      console.error('Pagination error:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [roomId, messages, loadingMore]);

  // ── Join ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;

    const init = async () => {
      const [{ data: roomPeek }, { data: existingPlayerRows }] = await Promise.all([
  supabase.from('community_rooms').select('status, is_locked, started_at, time_limit_minutes').eq('id', roomId).single(),
  supabase.from('community_room_players').select('id').eq('room_id', roomId).eq('user_id', user.id)
]);

const alreadyEnded = roomPeek?.status === 'ended';
const wasAlreadyPlayer = (existingPlayerRows || []).length > 0;
const windowExpired = !!roomPeek?.time_limit_minutes &&
  (Date.now() - new Date(roomPeek.started_at).getTime()) > roomPeek.time_limit_minutes * 60000;
const joinsClosed = alreadyEnded || !!roomPeek?.is_locked || windowExpired;

if (!joinsClosed || wasAlreadyPlayer) {
  await supabase.from('community_room_players').upsert({
    room_id: roomId, user_id: user.id,
    display_name: profile?.display_name || 'Player',
    avatar_url: profile?.avatar_url || null, score: 0
  }, { onConflict: 'room_id,user_id', ignoreDuplicates: true });
}

if (cancelled) return;
setIsLateJoiner(joinsClosed && !wasAlreadyPlayer);
await loadData();
    };

    init();
    return () => { cancelled = true; };
  }, [roomId, user, profile, loadData]);

  // ── Per-question countdown (client-visual; resets whenever the question changes) ──
  // Resets only when the question itself changes
  useEffect(() => {
    if (!currentQuestion || room?.status !== 'live') { setTimeLeft(null); return; }
    setTimeLeft(room.timer_duration || 30);
  }, [currentQuestion, room?.status, room?.timer_duration]);

  const isTimerStopped = timeLeft === null || isAiTyping || isCheckingAnswer;

  // Ticks every second — paused while an AI call (hint/help/judge) is in flight
  useEffect(() => {
    if (isTimerStopped) return;
    const id = setInterval(() => {
      setTimeLeft(t => (t !== null && t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [isTimerStopped]);

  // ── Correctness check (fast, free, local) ──────────────────────────────────
  const checkIfCorrect = useCallback((answer, question) => {
    if (!question) return false;
    const a = answer.toLowerCase().trim();
    const c = question.correct_answer_text?.toLowerCase().trim() || '';
    const accepted = question.accepted_answers?.map(x => x.toLowerCase().trim()) || [];
    return a === c || accepted.includes(a) ||
           (a.includes(c) && c.length > 3) || (c.includes(a) && a.length > 3);
  }, []);

  // ── Auth helper
  const getFreshAccessToken = useCallback(async () => {
    let { data: { session } } = await supabase.auth.getSession();
    const expiringSoon = !session?.access_token || (session.expires_at && (session.expires_at * 1000 - Date.now()) < 60000);
    if (expiringSoon) {
      const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
      if (!refreshErr && refreshed?.session) session = refreshed.session;
    }
    return session?.access_token || null;
  }, []);

  // ── AI soft-match
  const judgeAnswerWithAi = useCallback(async (answerText, question) => {
    if (!room?.ai_assistant_enabled) return false;
    try {
      const token = await getFreshAccessToken();
      const res = await fetch('/api/community-room-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'judge_answer',
          roomId, userId: user?.id,
          question: question.question_text,
          correctAnswer: question.correct_answer_text,
          acceptedAnswers: question.accepted_answers || [],
          userAnswer: answerText,
          subject: room?.subject
        })
      });
      if (!res.ok) return false;
      const data = await res.json();
      return data?.isCorrect === true;
    } catch (err) {
      console.error('❌ AI judge error:', err.message);
      return false;
    }
  }, [roomId, room?.ai_assistant_enabled, room?.subject, user?.id, getFreshAccessToken]);

  // ── Advances the room to the next question (or ends the quiz)
  const advanceRoom = useCallback(async (fromIndex) => {
    const currentIndex = fromIndex ?? (room?.current_question_index || 0);
    const nextIndex = currentIndex + 1;
    if (nextIndex >= questions.length) {
      await supabase.from('community_rooms')
        .update({ status: 'ended' })
        .eq('id', roomId)
        .eq('current_question_index', currentIndex);
      return;
    }
    await supabase.from('community_rooms').update({
      current_question_index: nextIndex, status: 'live',
      timer_remaining: room?.timer_duration || 30
    }).eq('id', roomId).eq('current_question_index', currentIndex);
  }, [roomId, room?.current_question_index, room?.timer_duration, questions.length]);

  // ── Timeout auto-advance
  useEffect(() => {
    if (!currentQuestion || room?.status !== 'live' || timeLeft !== 0) return;
    const fromIndex = room?.current_question_index || 0;
    const t = setTimeout(() => { advanceRoom(fromIndex); }, 2000);
    return () => clearTimeout(t);
  }, [currentQuestion, room?.status, timeLeft, room?.current_question_index, advanceRoom]);

  // ── Score update
  const updatePlayerScore = useCallback(async (points, question) => {
    try {
      const { error: incError } = await supabase.rpc('increment_player_score', {
        p_room_id: roomId, p_user_id: user.id, p_points: points,
      });
      if (incError) throw incError;

      if (question) {
        const fromIndex = room?.current_question_index || 0;
        const { error: wErr } = await supabase.from('community_room_winners').insert({
          room_id: roomId, user_id: user.id, question_id: question.id
        });
        if (wErr && wErr.code !== '23505') throw wErr;
        if (!wErr) {
          setTimeout(() => { advanceRoom(fromIndex); }, 2500);
        }
      }
    } catch (err) {
      console.error('❌ Score update error:', err.message);
    }
  }, [roomId, room?.current_question_index, user?.id, advanceRoom]);

  // ── AI call
  const askAi = useCallback(async ({ action, question, message, playerName, isCorrect }) => {
    if (!room?.ai_assistant_enabled) return;
    setIsAiTyping(true);

    const attempt = async () => {
      const token = await getFreshAccessToken();
      return fetch('/api/community-room-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          roomId, question, message, userId: user?.id, playerName,
          action, difficulty: room?.difficulty, subject: room?.subject, isCorrect
        })
      });
    };

    try {
      let res = await attempt();
      if (!res.ok && res.status >= 500) {
        await new Promise(r => setTimeout(r, 800));
        res = await attempt();
      }
      if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        console.error('❌ AI request failed:', res.status, bodyText);
        if (res.status === 401) {
          setSendError('Your session looks expired — try refreshing the page.');
        } else if (res.status === 429) {
          setSendError("Vaibey's getting a lot of requests right now — wait a few seconds and try again.");
        } else {
          setSendError(`Vaibey hiccupped (error ${res.status}) — try again in a sec.`);
        }
      }
    } catch (err) {
      console.error('❌ AI request error:', err.message);
      setSendError('Vaibey hiccupped — try again in a sec.');
    } finally {
      setIsAiTyping(false);
    }
  }, [roomId, room?.ai_assistant_enabled, room?.difficulty, room?.subject, user?.id, getFreshAccessToken]);

  // ── Realtime
  useEffect(() => {
    if (!user || !roomId) return;

    const channel = supabase.channel(`room-${roomId}`, {
      config: { presence: { key: user.id } }
    });

    channel.on('presence', { event: 'sync' }, () => {
      setActiveCount(Object.keys(channel.presenceState()).length);
    });

    channel.on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'community_rooms', filter: `id=eq.${roomId}`
    }, payload => setRoom(payload.new));

    channel.on('postgres_changes', {
      event: '*', schema: 'public', table: 'community_room_players', filter: `room_id=eq.${roomId}`
    }, async () => {
      const { data } = await supabase
        .from('community_room_players').select('*')
        .eq('room_id', roomId).order('score', { ascending: false });
      if (data) {
        const prevScores = prevScoresRef.current;
        const newFlashes = {};
        data.forEach(p => {
          const before = prevScores[p.user_id];
          if (before !== undefined && p.score > before) {
            newFlashes[p.user_id] = { delta: p.score - before };
          }
        });
        if (Object.keys(newFlashes).length) {
          setFlashes(f => ({ ...f, ...newFlashes }));
          Object.keys(newFlashes).forEach(uid => {
            setTimeout(() => {
              setFlashes(f => { const next = { ...f }; delete next[uid]; return next; });
            }, 1300);
          });
        }
        prevScoresRef.current = Object.fromEntries(data.map(p => [p.user_id, p.score]));
        setPlayers(data);
      }
    });

    channel.on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'community_room_chat', filter: `room_id=eq.${roomId}`
    }, async payload => {
      let msg = { ...payload.new, profiles: null };
      if (payload.new.user_id) {
        const { data } = await supabase
          .from('profiles').select('display_name, avatar_url')
          .eq('id', payload.new.user_id).single();
        msg.profiles = data;
      }
      setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
    });

    channel.on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'community_room_winners', filter: `room_id=eq.${roomId}`
    }, async payload => {
      const { data } = await supabase
        .from('community_room_players').select('display_name')
        .eq('room_id', roomId).eq('user_id', payload.new.user_id).single();
      setWinner(data?.display_name);
      setTimeout(() => setWinner(null), 5000);
    });

    channel.subscribe(async status => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ user_id: user.id, display_name: profile?.display_name });
      }
    });

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [roomId, user, profile]);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // ── Send message
  const sendMessage = async e => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !user) return;

    const isAnswer = !!(currentQuestion && room?.status === 'live' && !hasAnsweredCorrectly && attemptsLeft > 0 && !timeUp);
    if (isAnswer && (isAiTyping || isCheckingAnswer)) return;

    setInput('');
    setSendError(null);

    let isCorrect = null;
    if (isAnswer) {
      isCorrect = checkIfCorrect(text, currentQuestion);
      if (!isCorrect) {
        setIsCheckingAnswer(true);
        isCorrect = await judgeAnswerWithAi(text, currentQuestion);
        setIsCheckingAnswer(false);
      }
    }

    const { error } = await supabase.from('community_room_chat').insert({
      room_id: roomId, user_id: user.id, message: text,
      message_type: isAnswer ? 'answer' : 'chat',
      question_id: isAnswer ? currentQuestion.id : null,
      is_correct: isAnswer ? isCorrect : null
    });

    if (error) {
      console.error('❌ Failed to send message:', error.message);
      setSendError("Couldn't send that — try again.");
      setInput(text);
      return;
    }

    if (isAnswer && isCorrect) {
      await updatePlayerScore(10, currentQuestion);
    }
  };

  const forceAdvance = () => {
    if (!isHost) return;
    advanceRoom();
  };

  const toggleAi = async () => {
    if (!isHost) return;
    await supabase.from('community_rooms').update({
      ai_assistant_enabled: !room.ai_assistant_enabled
    }).eq('id', roomId);
  };

  const toggleLock = async () => {
  if (!isHost) return;
  await supabase.from('community_rooms').update({ is_locked: !room.is_locked }).eq('id', roomId);
};

  const handleMobileTabTap = (tab) => {
    if (sidebarTab === tab && mobilePanelOpen) { setMobilePanelOpen(false); return; }
    setSidebarTab(tab);
    setMobilePanelOpen(true);
  };

  const sendQuickAction = async action => {
    if (!currentQuestion || !user || isAiTyping) return;
    if (!room?.ai_assistant_enabled) {
      setSendError('AI Assistant is disabled for this room — ask the host to enable it in Controls.');
      return;
    }
    const labels    = { hint: 'Can I get a hint for this question?', help: 'I need help with this question.' };
    const chatTypes = { hint: 'hint_request', help: 'help_request' };

    const { error } = await supabase.from('community_room_chat').insert({
      room_id: roomId, user_id: user.id,
      message: labels[action], message_type: chatTypes[action], is_correct: null
    });
    if (error) { console.error('❌ Quick action chat insert failed:', error.message); return; }

    await askAi({
      action: 'hint_request',
      question: currentQuestion.question_text,
      message: labels[action],
      playerName: profile?.display_name
    });
  };

  const getPlaceholder = () => {
    if (room?.status === 'ended') return 'Quiz complete — chat is still open';
    if (hasAnsweredCorrectly) return 'Correct — waiting for the next question';
    if (attemptsLeft <= 0) return 'No tries remaining — wait for the next question';
    if (timeUp) return `Time's up — ${attemptsLeft} ${attemptsLeft === 1 ? 'try' : 'tries'} remaining`;
    if (isCheckingAnswer) return 'Checking your answer…';
    if (isAiTyping) return 'Waiting on Vaibey…';
    if (currentQuestion && room?.status === 'live') return `Type your answer — ${attemptsLeft} ${attemptsLeft === 1 ? 'try' : 'tries'} left`;
    return 'Say something…';
  };

  const renderFinalLeaderboard = (opts = {}) => {
    const sorted = [...players].sort((a, b) => b.score - a.score);
    const medals = ['🥇', '🥈', '🥉'];
    return (
      <div className="crp-results">
        <div className="crp-results-header">
          <span className="crp-results-trophy">🏆</span>
          <h3>Quiz Complete!</h3>
          <p className="crp-results-sub">
            {questions.length} question{questions.length === 1 ? '' : 's'} · {sorted.length} player{sorted.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="crp-results-list">
          {sorted.length === 0 && <p className="crp-results-empty">No players participated in this quiz.</p>}
          {sorted.map((p, i) => (
            <div key={p.id} className={`crp-results-row ${p.user_id === user?.id ? 'me' : ''} ${i === 0 ? 'first' : ''}`}>
              <span className="crp-results-rank">{medals[i] || `#${i + 1}`}</span>
              <Avatar url={p.avatar_url} name={p.display_name} size={30} />
              <span className="crp-results-name">{p.display_name}{p.user_id === user?.id ? ' (You)' : ''}</span>
              <span className="crp-results-score">{p.score} pts</span>
            </div>
          ))}
        </div>
        {opts.lateJoiner && (
          <p className="crp-results-note">You joined after this quiz ended, so you weren't added as a player.</p>
        )}
      </div>
    );
  };

  // Shared by the desktop sidebar (rendered inline) and the mobile bottom
  // sheet (rendered on demand) — identical panels, different container.
  const renderSidebarPanelContent = () => (
    <>
      {sidebarTab === 'players' && (
        <div className="crp-panel">
          {players.map((p, i) => (
            <div key={p.id} className={`crp-player-row ${p.user_id === user?.id ? 'me' : ''} ${flashes[p.user_id] ? 'flash' : ''}`}>
              <span className="crp-rank">{i + 1}</span>
              <Avatar url={p.avatar_url} name={p.display_name} size={22} />
              <span className="crp-player-name">{p.display_name}</span>
              <span className="crp-player-pts">
                {p.score}
                {flashes[p.user_id] && <span className="crp-pts-pop">+{flashes[p.user_id].delta}</span>}
              </span>
            </div>
          ))}
          <div className="crp-my-score">Your score: <strong>{myScore}</strong></div>
        </div>
      )}

      {sidebarTab === 'controls' && isHost && (
        <div className="crp-panel">
          <p className="crp-panel-label">Room Controls</p>
          <button className="crp-ctrl-btn" onClick={toggleAi}>
            {room.ai_assistant_enabled ? 'AI: On' : 'AI: Off'}
          </button>
          <button className="crp-ctrl-btn" onClick={forceAdvance} disabled={room.status === 'ended'}>
            {(room.current_question_index || 0) >= questions.length - 1 ? 'Force End Quiz' : 'Force Next Question'}
          </button>
          <button className="crp-ctrl-btn" onClick={toggleLock}>
            {room.is_locked ? '🔓 Unlock Joining' : '🔒 Lock Joining'}
          </button>
          <p className="crp-panel-hint">The room now advances automatically once someone answers correctly, or when the timer runs out. Use this only if a round still gets stuck.</p>
        </div>
      )}

      {sidebarTab === 'ai' && (
        <div className="crp-panel">
          <p className="crp-panel-label">AI Assistant</p>
          <div className={`crp-ai-status-badge ${room.ai_assistant_enabled ? 'on' : 'off'}`}>
            <i className="crp-dot" />{room.ai_assistant_enabled ? 'Active' : 'Disabled'}
          </div>
          {isHost && (
            <button className="crp-ctrl-btn" onClick={toggleAi}>
              {room.ai_assistant_enabled ? 'Disable' : 'Enable'}
            </button>
          )}
          <div className="crp-quick-actions">
            <button className="crp-qa-btn" onClick={() => sendQuickAction('hint')} disabled={isAiTyping || room.status === 'ended'}>Hint</button>
            <button className="crp-qa-btn" onClick={() => sendQuickAction('help')} disabled={isAiTyping || room.status === 'ended'}>Help</button>
          </div>
          {isAiTyping && <div className="crp-ai-typing">Vaibey is thinking…</div>}
        </div>
      )}
    </>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!user) return (
  <div className="crp-loading">
    <p>Sign in to join this live quiz.</p>
    <button className="crp-ctrl-btn" onClick={() => window.dispatchEvent(new CustomEvent('open-auth'))}>
      Sign In
    </button>
  </div>
);
  if (loading) return <div className="crp-loading">Loading Quiz Arena…</div>;
  if (!room)   return <div className="crp-loading">Room not found.</div>;

  if (room.status === 'ended' && isLateJoiner) {
    return (
      <div className="crp-container">
        {room.cover_media_url && (
          <div className="crp-cover-banner">
            {room.cover_media_type === 'video' ? (
              <video src={room.cover_media_url} className="crp-cover-media" autoPlay loop muted playsInline />
            ) : (
              <img src={room.cover_media_url} alt="" className="crp-cover-media" />
            )}
            <div className="crp-cover-overlay" />
          </div>
        )}
        <div className="crp-header">
          <div className="crp-title-row">
            <h2 className="crp-room-title">{room.title}</h2>
            <span className="crp-subject-pill">{room.subject}</span>
          </div>
          <div className="crp-header-right">
            <button className="crp-close" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>
        <div className="crp-ended-body">
          <p className="crp-ended-banner">⏳ This quiz has already ended — here's how it went.</p>
          {renderFinalLeaderboard({ lateJoiner: true })}
        </div>
      </div>
    );
  }

  const qIdx = room.current_question_index || 0;
  const declaration = room.status === 'ended'
    ? 'Quiz Complete'
    : currentQuestion ? `Question ${qIdx + 1} of ${questions.length}`
    : 'Waiting for host to start';

  return (
    <div className="crp-container">

      {room.cover_media_url && (
        <div className="crp-cover-banner">
          {room.cover_media_type === 'video' ? (
            <video src={room.cover_media_url} className="crp-cover-media" autoPlay loop muted playsInline />
          ) : (
            <img src={room.cover_media_url} alt="" className="crp-cover-media" />
          )}
          <div className="crp-cover-overlay" />
        </div>
      )}

      {/* ── Header ── */}
      <div className="crp-header">
        <div className="crp-title-row">
          <h2 className="crp-room-title">{room.title}</h2>
          <span className="crp-subject-pill">{room.subject}</span>
        </div>
        <div className="crp-header-right">
          <span className="crp-stat crp-stat-online"><i className="crp-dot" />{activeCount} online</span>
          <span className="crp-stat crp-stat-players">{players.length} players</span>
          {isHost && <span className="crp-stat crp-stat-host">Host</span>}
          <button className="crp-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
      </div>

      {/* ── Question card ── */}
      {currentQuestion && room.status !== 'ended' && (
        <div className="crp-question-card">
          <div className="crp-question-top">
            <div className="crp-q-badge">Q{qIdx + 1}</div>
            <div className="crp-q-text">{currentQuestion.question_text}</div>
          </div>
          <div className="crp-question-meta">
            <span className="crp-meta-chip crp-meta-progress">Question {qIdx + 1}/{questions.length}</span>
            <span className={`crp-meta-chip crp-meta-timer ${timeUp ? 'urgent' : ''}`}>{timeLeft ?? room.timer_remaining ?? 0}s</span>
            <span className="crp-meta-chip crp-meta-diff">{room.difficulty}</span>
            <span className="crp-meta-chip crp-meta-attempts">{attemptsLeft} {attemptsLeft === 1 ? 'try' : 'tries'} left</span>
          </div>
        </div>
      )}

      {/* ── Final results (ended) or waiting declaration ── */}
      {room.status === 'ended' ? (
        renderFinalLeaderboard()
      ) : !currentQuestion ? (
        <div className="crp-declaration">{declaration}</div>
      ) : null}

      {/* ── Winner toast ── */}
      {winner && (
        <div className="crp-winner-toast">
          <span className="crp-winner-label">Winner</span> {winner} answered first
        </div>
      )}

      {/* ── Body: sidebar + feed ── */}
      <div className="crp-body">

        {/* ── Sidebar — desktop only; mobile uses the tab bar + sheet below ── */}
        {!isMobile && (
          <div className="crp-sidebar">
            <div className="crp-sidebar-tabs">
              <button className={sidebarTab === 'players' ? 'active' : ''} onClick={() => setSidebarTab('players')}>Players</button>
              {isHost && (
                <button className={sidebarTab === 'controls' ? 'active' : ''} onClick={() => setSidebarTab('controls')}>Controls</button>
              )}
              <button className={sidebarTab === 'ai' ? 'active' : ''} onClick={() => setSidebarTab('ai')}>Assistant</button>
            </div>
            {renderSidebarPanelContent()}
          </div>
        )}

        {/* ── Chat feed — unchanged ── */}
        <div className="crp-feed">
          <div className="crp-messages">
            {hasMore && (
              <button className="crp-load-more" onClick={loadOlderMessages} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : 'Load older messages'}
              </button>
            )}

            {messages.map((m, i) => {
              if (m.message_type === 'system') {
                return <div key={m.id} className="crp-msg-system">{m.message}</div>;
              }

              const isAiMsg   = m.message_type === 'ai_response' || m.message_type === 'ai_hint';
              const isAns     = m.message_type === 'answer';
              const isHintReq = m.message_type === 'hint_request';
              const isHelpReq = m.message_type === 'help_request';
              const correct   = m.is_correct;
              const isMine    = !isAiMsg && m.user_id === user?.id;
              const authorName = isAiMsg ? 'Vaibey' : (m.profiles?.display_name || 'Player');

              const prev = messages[i - 1];
              const senderKey = isAiMsg ? 'ai' : (m.user_id || 'unknown');
              const prevSenderKey = prev
                ? (prev.message_type === 'ai_response' || prev.message_type === 'ai_hint' ? 'ai' : (prev.user_id || 'unknown'))
                : null;
              
              const grouped = !!prev &&
                prev.message_type !== 'system' &&
                senderKey === prevSenderKey &&
                typeGroup(prev) === typeGroup(m) &&
                (new Date(m.created_at) - new Date(prev.created_at)) < GROUP_WINDOW_MS;

              return (
                <div
                  key={m.id}
                  className={[
                    'crp-msg',
                    isMine ? 'mine' : '',
                    isAiMsg ? 'ai' : '',
                    isHintReq ? 'hint-request' : '',
                    isHelpReq ? 'help-request' : '',
                    isAns && correct === true  ? 'answer-correct'   : '',
                    isAns && correct === false ? 'answer-incorrect' : '',
                    grouped ? 'grouped' : '',
                  ].filter(Boolean).join(' ')}
                >
                  {!grouped && (
                    <div className="crp-msg-header">
                      {isAiMsg
                        ? <span className="crp-msg-badge-ai">AI</span>
                        : <Avatar url={m.profiles?.avatar_url} name={authorName} size={20} />}
                      <span className="crp-msg-author">{authorName}</span>
                      {isAns && correct !== null && correct !== undefined && (
                        <span className={`crp-badge ${correct ? 'correct' : 'incorrect'}`}>
                          {correct ? 'Correct' : 'Incorrect'}
                        </span>
                      )}
                      {isHintReq && <span className="crp-badge hint">💡 Hint</span>}
                      {isHelpReq && <span className="crp-badge hint">🆘 Help</span>}
                      {m.message_type === 'ai_hint' && <span className="crp-badge hint">💡 Hint</span>}
                    </div>
                  )}
                  <div className="crp-msg-text">{m.message}</div>
                  <div className="crp-msg-time">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              );
            })}

            {isAiTyping && (
              <div className="crp-msg ai">
                <div className="crp-msg-header">
                  <span className="crp-msg-badge-ai">AI</span>
                  <span className="crp-msg-author">Vaibey</span>
                </div>
                <div className="crp-msg-text crp-typing-dots">● ● ●</div>
              </div>
            )}
            <div ref={feedEndRef} />
          </div>

          {sendError && <div className="crp-send-error">{sendError}</div>}

          <form className="crp-input-bar" onSubmit={sendMessage}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={getPlaceholder()}
              disabled={currentQuestion && room.status === 'live' && answerLocked}
            />
            <button
              type="submit"
              disabled={!input.trim() || room.status === 'ended' || (currentQuestion && room.status === 'live' && answerLocked)}
            >↑</button>
          </form>
        </div>
      </div>

      {/* ── Mobile: compact trigger bar, opens the same panels in a sheet ── */}
      {isMobile && (
        <div className="crp-mobile-tabbar">
          <button className={sidebarTab === 'players' && mobilePanelOpen ? 'active' : ''} onClick={() => handleMobileTabTap('players')}>
            👥 Players <span className="crp-mobile-tab-count">{players.length}</span>
          </button>
          {isHost && (
            <button className={sidebarTab === 'controls' && mobilePanelOpen ? 'active' : ''} onClick={() => handleMobileTabTap('controls')}>
              ⚙️ Controls
            </button>
          )}
          <button className={sidebarTab === 'ai' && mobilePanelOpen ? 'active' : ''} onClick={() => handleMobileTabTap('ai')}>
            🤖 Assistant{room.ai_assistant_enabled && <span className="crp-mobile-tab-dot" />}
          </button>
        </div>
      )}

      {isMobile && mobilePanelOpen && createPortal(
        <div className="crp-mobile-sheet-overlay" onClick={() => setMobilePanelOpen(false)}>
          <div className="crp-mobile-sheet" onClick={e => e.stopPropagation()}>
            <div className="crp-mobile-sheet-handle" />
            <div className="crp-mobile-sheet-header">
              <span>{sidebarTab === 'players' ? '👥 Players' : sidebarTab === 'controls' ? '⚙️ Controls' : '🤖 Assistant'}</span>
              <button onClick={() => setMobilePanelOpen(false)} aria-label="Close">✕</button>
            </div>
            <div className="crp-mobile-sheet-body">{renderSidebarPanelContent()}</div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default CommunityRoomPlay;