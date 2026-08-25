import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Standard ISO 8601 Week String (e.g., "2026-W32")
const getISOWeekString = (date) => {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7; // Make Sunday = 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // Set to nearest Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

const awardTop = async (sinceISO, untilISO, badgeKey, badgeType) => {
  // 1. Fetch top user directly from Postgres (O(1) memory, bypasses 1000 row limit)
  const { data: winner, error } = await supabase.rpc('get_leaderboard_winner', {
    since: sinceISO,
    until: untilISO
  });

  if (error) {
    console.error(`❌ RPC failed for ${badgeKey}:`, error.message);
    return { success: false, error: error.message };
  }

  if (!winner || winner.length === 0) {
    console.log(`ℹ️ No activity found for ${badgeKey}. Skipping.`);
    return { success: true, skipped: true };
  }

  const { user_id, total_points } = winner[0];

  // 2. Award the badge (Idempotent via onConflict)
  const { error: upsertError } = await supabase
    .from('user_badges')
    .upsert(
      { 
        user_id, 
        badge_key: badgeKey, 
        badge_type: badgeType, 
        points_at_award: total_points 
      },
      { onConflict: 'user_id,badge_key', ignoreDuplicates: true }
    );

  if (upsertError) {
    console.error(`❌ Upsert failed for ${badgeKey}:`, upsertError.message);
    return { success: false, error: upsertError.message };
  }

  console.log(`✅ Awarded ${badgeType} to ${user_id} (${total_points} pts)`);
  return { success: true, awarded: true };
};

export default async function handler(req, res) {
  // 1. Strict Security: No query params (prevents secret leakage in logs)
  const CRON_SECRET = process.env.CRON_SECRET;
  if (!CRON_SECRET) {
    return res.status(500).json({ error: 'Server misconfiguration: CRON_SECRET missing' });
  }
  if (req.headers.authorization !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 2. Date Math
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const yesterdayUTC = new Date(todayUTC); 
  yesterdayUTC.setUTCDate(todayUTC.getUTCDate() - 1);

  const results = { daily: null, weekly: null, monthly: null };

  // Daily (Player of the Day)
  results.daily = await awardTop(
    yesterdayUTC.toISOString(), 
    todayUTC.toISOString(),
    `potd_${yesterdayUTC.toISOString().slice(0, 10)}`, 
    'player_of_day'
  );

  // Weekly (Player of the Week) - Runs on Sundays for the previous Mon-Sun week
  if (todayUTC.getUTCDay() === 0) { 
    const weekStart = new Date(todayUTC); 
    weekStart.setUTCDate(todayUTC.getUTCDate() - 7);
    const isoLabel = getISOWeekString(weekStart);
    
    results.weekly = await awardTop(
      weekStart.toISOString(), 
      todayUTC.toISOString(), 
      `potw_${isoLabel}`, 
      'player_of_week'
    );
  }

  // Monthly (Player of the Month) - Runs on the 1st for the previous month
  if (todayUTC.getUTCDate() === 1) { 
    const monthStart = new Date(Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth() - 1, 1));
    const label = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, '0')}`;
    
    results.monthly = await awardTop(
      monthStart.toISOString(), 
      todayUTC.toISOString(), 
      `potm_${label}`, 
      'player_of_month'
    );
  }

  // 3. Return detailed results for Vercel logs
  const hasErrors = Object.values(results).some(r => r && !r.success);
  
  return res.status(hasErrors ? 500 : 200).json({ 
    ok: !hasErrors, 
    results,
    executed_at: now.toISOString() 
  });
}