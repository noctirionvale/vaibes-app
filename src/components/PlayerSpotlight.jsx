import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { getPeriodStart, rankByActivity, attachProfiles, attachBadges } from '../lib/badgeQueries';
import BadgeRow from './BadgeRow';
import PointsDashboard from './PointsDashboard';
import './PlayerSpotlight.css';

const PERIODS = [
  { key: 'day',   label: 'Player of the Day',   icon: '🔥' },
  { key: 'week',  label: 'Player of the Week',  icon: '⚡' },
  { key: 'month', label: 'Player of the Month', icon: '👑' },
];

const PlayerSpotlight = () => {
  const [loading, setLoading] = useState(true);
  const [boards, setBoards] = useState({ day: [], week: [], month: [] });
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('day');
  const [showFullDashboard, setShowFullDashboard] = useState(false);

  const channelIdRef = useRef(`player-spotlight-${Math.random().toString(36).slice(2)}`);

  const load = useCallback(async () => {
    try {
      const entries = await Promise.all(
        PERIODS.map(async p => {
          const ranked = await rankByActivity(getPeriodStart(p.key).toISOString());
          const withProfiles = await attachProfiles(ranked.slice(0, 5));
          const withBadges = await attachBadges(withProfiles);
          return [p.key, withBadges];
        })
      );
      setBoards(Object.fromEntries(entries));
    } catch (err) {
      console.error('❌ PlayerSpotlight load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const pollId = setInterval(load, 5 * 60 * 1000);
    let debounceTimer = null;
    const scheduleReload = () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(load, 800); };

    const channel = supabase
      .channel(channelIdRef.current)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_room_winners' }, scheduleReload)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'community_room_winners' }, scheduleReload)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'edufeed_quiz_completions' }, scheduleReload)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'edufeed_quiz_completions' }, scheduleReload)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_badges' }, scheduleReload)
      .subscribe();

    return () => { clearInterval(pollId); clearTimeout(debounceTimer); supabase.removeChannel(channel); };
  }, [load]);

  const segments = useMemo(() => {
    return PERIODS.map(p => { const top = boards[p.key]?.[0]; return top ? { ...p, ...top } : null; }).filter(Boolean);
  }, [boards]);

  if (loading || segments.length === 0) return null;

  return (
    <>
      <div className="ps-ticker" onClick={() => setExpanded(true)} role="button" tabIndex={0}
        title="See the full leaderboard" onKeyDown={e => { if (e.key === 'Enter') setExpanded(true); }}>
        <div className="ps-ticker-track">
          {[...segments, ...segments].map((s, i) => (
            <span className="ps-item" key={`${s.key}-${i}`}>
              <span className="ps-icon">{s.icon}</span>
              <span className="ps-label">{s.label}</span>
              <span className="ps-sep">·</span>
              {s.avatar ? <img className="ps-avatar" src={s.avatar} alt="" /> : <span className="ps-avatar ps-avatar-fallback">{s.name[0]?.toUpperCase()}</span>}
              <span className="ps-name">{s.name}</span>
              {s.badges?.length > 0 && <BadgeRow badges={s.badges} />}
              <span className="ps-score">{s.points} pts</span>
              <span className="ps-gap">✦</span>
            </span>
          ))}
        </div>
      </div>

      {expanded && createPortal(
        <div className="modal-overlay" onClick={() => setExpanded(false)}>
          <div className="ps-modal" onClick={e => e.stopPropagation()}>
            <div className="ps-modal-header">
              <h3>🏆 Leaderboard</h3>
              <button className="ps-modal-close" onClick={() => setExpanded(false)}>✕</button>
            </div>
            <div className="ps-modal-tabs">
              {PERIODS.map(p => (
                <button key={p.key} className={activeTab === p.key ? 'active' : ''} onClick={() => setActiveTab(p.key)}>
                  {p.icon} {p.label.replace('Player of the ', '')}
                </button>
              ))}
            </div>
            <div className="ps-modal-list">
              {(boards[activeTab] || []).length === 0 ? (
                <p className="ps-modal-empty">No wins or completed quizzes yet for this period — be the first! ⚡</p>
              ) : boards[activeTab].map((p, i) => (
                <div key={p.userId} className={`ps-row ${i === 0 ? 'first' : ''}`}>
                  <span className="ps-rank">{['🥇', '🥈', '🥉'][i] || `#${i + 1}`}</span>
                  {p.avatar ? <img className="ps-row-avatar" src={p.avatar} alt="" /> : <span className="ps-row-avatar ps-avatar-fallback">{p.name[0]?.toUpperCase()}</span>}
                  <span className="ps-row-name">{p.name}</span>
                  {p.badges?.length > 0 && <BadgeRow badges={p.badges} />}
                  <span className="ps-row-wins">
                    {[p.wins > 0 ? `${p.wins} win${p.wins === 1 ? '' : 's'}` : null, p.quizzes > 0 ? `${p.quizzes} quiz${p.quizzes === 1 ? '' : 'zes'}` : null].filter(Boolean).join(' · ')}
                  </span>
                  <span className="ps-row-pts">{p.points} pts</span>
                </div>
              ))}
            </div>
            <button className="ps-dashboard-link" onClick={() => { setExpanded(false); setShowFullDashboard(true); }}>
              🚀 View Full Dashboard &amp; Badges
            </button>
            <p className="ps-modal-note">Based on live Quiz Arena wins and completed EduFeed quizzes (Studio Quiz, Subject Quiz, Flashcard).</p>
          </div>
        </div>,
        document.body
      )}

      {showFullDashboard && <PointsDashboard onClose={() => setShowFullDashboard(false)} />}
    </>
  );
};

export default PlayerSpotlight;