import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { BADGE_DEFS, PIONEER_CONFIG, resolveBadgeType } from '../lib/badgeDefs';
import { getPeriodStart, rankByActivity, attachProfiles, attachBadges } from '../lib/badgeQueries';
import BadgeRow from './BadgeRow';
import './PointsDashboard.css';

const TABS = [
  { key: 'day', label: 'Today' }, { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' }, { key: 'all', label: 'All-Time' },
];

const PointsDashboard = ({ onClose, embedded = false }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('week');
  const [board, setBoard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myLifetimePoints, setMyLifetimePoints] = useState(0);
  const [myBadges, setMyBadges] = useState([]);
  const [pioneerTaken, setPioneerTaken] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const ranked = await rankByActivity(getPeriodStart(activeTab).toISOString());
      const withProfiles = await attachProfiles(ranked.slice(0, 20));
      setBoard(await attachBadges(withProfiles));

      if (user?.id) {
        const allTime = await rankByActivity(new Date(0).toISOString());
        setMyLifetimePoints(allTime.find(r => r.userId === user.id)?.points || 0);
        const { data: badgeRows } = await supabase.from('user_badges').select('badge_key, badge_type').eq('user_id', user.id);
        setMyBadges(badgeRows || []);
      }
      const { count } = await supabase.from('user_badges').select('*', { count: 'exact', head: true }).eq('badge_type', 'pioneer');
      setPioneerTaken(count || 0);
    } catch (err) {
      console.error('❌ PointsDashboard load error:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, user?.id]);

  useEffect(() => { load(); }, [load]);

  const haveBadgeType = useMemo(() => new Set(myBadges.map(b => resolveBadgeType(b.badge_key, b.badge_type))), [myBadges]);
  const iPioneered = haveBadgeType.has('pioneer');

  const body = (
    <div className="pd-body">
      {user && (
        <div className="pd-my-card">
          <div className="pd-my-points">
            <span className="pd-my-points-label">Your Lifetime Points</span>
            <span className="pd-my-points-value">{myLifetimePoints.toLocaleString()}</span>
          </div>
          {!iPioneered && pioneerTaken < PIONEER_CONFIG.cap && (
            <div className="pd-pioneer-progress">
              <div className="pd-pioneer-bar">
                <div className="pd-pioneer-fill" style={{ width: `${Math.min(100, (myLifetimePoints / PIONEER_CONFIG.target) * 100)}%` }} />
              </div>
              <span className="pd-pioneer-text">
                🚀 {Math.max(0, PIONEER_CONFIG.target - myLifetimePoints)} pts to Pioneer badge · {PIONEER_CONFIG.cap - pioneerTaken} spots left
              </span>
            </div>
          )}
          {myBadges.length > 0 && <BadgeRow badges={myBadges} size="lg" max={8} />}
        </div>
      )}

      <div className="pd-tabs">
        {TABS.map(t => <button key={t.key} className={activeTab === t.key ? 'active' : ''} onClick={() => setActiveTab(t.key)}>{t.label}</button>)}
      </div>

      <div className="pd-list">
        {loading ? <p className="pd-empty">Loading leaderboard…</p>
        : board.length === 0 ? <p className="pd-empty">No activity yet for this period — be the first! ⚡</p>
        : board.map((p, i) => (
          <div key={p.userId} className={`pd-row ${i === 0 ? 'first' : ''} ${p.userId === user?.id ? 'me' : ''}`}>
            <span className="pd-rank">{['🥇', '🥈', '🥉'][i] || `#${i + 1}`}</span>
            {p.avatar ? <img className="pd-avatar" src={p.avatar} alt="" /> : <span className="pd-avatar pd-avatar-fallback">{p.name[0]?.toUpperCase()}</span>}
            <span className="pd-name">{p.name}</span>
            <BadgeRow badges={p.badges} />
            <span className="pd-pts">{p.points} pts</span>
          </div>
        ))}
      </div>

      <div className="pd-badge-case">
        <h4>Badge Case</h4>
        <div className="pd-badge-grid">
          {Object.entries(BADGE_DEFS).map(([type, def]) => {
            const earned = haveBadgeType.has(type);
            const count = myBadges.filter(b => resolveBadgeType(b.badge_key, b.badge_type) === type).length;
            return (
              <div key={type} className={`pd-badge-card ${earned ? 'earned' : 'locked'}`} style={{ '--badge-color': def.color }}>
                <span className="pd-badge-icon">{def.icon}</span>
                <span className="pd-badge-label">{def.label}</span>
                <span className="pd-badge-desc">{def.desc}</span>
                {earned && count > 1 && <span className="pd-badge-count">×{count}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  if (embedded) return <div className="pd-wrapper pd-embedded">{body}</div>;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="pd-wrapper pd-modal" onClick={e => e.stopPropagation()}>
        <div className="pd-header">
          <h3>🏆 Leaderboard &amp; Badges</h3>
          <button className="pd-close" onClick={onClose}>✕</button>
        </div>
        {body}
      </div>
    </div>
  );
};

export default PointsDashboard;