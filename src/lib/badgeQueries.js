import { supabase } from './supabase';

export const getPeriodStart = (key) => {
  const now = new Date();
  if (key === 'day')   { const d = new Date(now); d.setHours(0, 0, 0, 0); return d; }
  if (key === 'week')  { const d = new Date(now); d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0); return d; }
  if (key === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  return new Date(0); // 'all'
};

export const rankByActivity = async (sinceISO) => {
  const [{ data: wins, error: winsErr }, { data: completions, error: compErr }] = await Promise.all([
    supabase.from('community_room_winners').select('user_id').gte('created_at', sinceISO),
    supabase.from('edufeed_quiz_completions').select('user_id, points').gte('created_at', sinceISO),
  ]);
  if (winsErr) console.error('❌ rankByActivity wins fetch error:', winsErr);
  if (compErr) console.error('❌ rankByActivity completions fetch error:', compErr);

  const byUser = {};
  const bump = (userId) => (byUser[userId] ||= { userId, wins: 0, quizzes: 0, points: 0 });
  (wins || []).forEach(row => { const u = bump(row.user_id); u.wins += 1; u.points += 10; });
  (completions || []).forEach(row => { const u = bump(row.user_id); u.quizzes += 1; u.points += row.points || 0; });
  return Object.values(byUser).sort((a, b) => b.points - a.points);
};

export const attachProfiles = async (ranked) => {
  if (ranked.length === 0) return [];
  const { data: profiles } = await supabase.from('profiles').select('id, display_name, avatar_url').in('id', ranked.map(r => r.userId));
  const byId = Object.fromEntries((profiles || []).map(p => [p.id, p]));
  return ranked.map(r => ({ ...r, name: byId[r.userId]?.display_name || 'Player', avatar: byId[r.userId]?.avatar_url || null }));
};

export const attachBadges = async (rows) => {
  if (rows.length === 0) return [];
  const { data: badges, error } = await supabase.from('user_badges').select('user_id, badge_key, badge_type').in('user_id', rows.map(r => r.userId));
  if (error) console.error('❌ attachBadges fetch error:', error);
  const byUser = {};
  (badges || []).forEach(b => { (byUser[b.user_id] ||= []).push(b); });
  return rows.map(r => ({ ...r, badges: byUser[r.userId] || [] }));
};