export const BADGE_DEFS = {
  pioneer:          { icon: '🚀', label: 'Pioneer',        color: '#a78bfa', desc: 'Among the first to reach 1,000 points' },
  player_of_day:    { icon: '🔥', label: 'Day Champion',   color: '#fbbf24', desc: '#1 on the daily leaderboard' },
  player_of_week:   { icon: '⚡', label: 'Week Champion',  color: '#60a5fa', desc: '#1 on the weekly leaderboard' },
  player_of_month:  { icon: '👑', label: 'Month Champion', color: '#f59e0b', desc: '#1 on the monthly leaderboard' },
  live_quiz_winner: { icon: '🏁', label: 'Arena Winner',   color: '#10b981', desc: 'Won a live Quiz Arena race' },
};

export const PIONEER_CONFIG = { target: 1000, cap: 50 }; // keep in sync with the SQL trigger above

export const resolveBadgeType = (badgeKey, fallbackType) => {
  if (!badgeKey) return fallbackType || 'unknown';
  if (badgeKey.startsWith('potd_')) return 'player_of_day';
  if (badgeKey.startsWith('potw_')) return 'player_of_week';
  if (badgeKey.startsWith('potm_')) return 'player_of_month';
  if (BADGE_DEFS[badgeKey]) return badgeKey; // If it's already a valid badge type
  return fallbackType || badgeKey;
};