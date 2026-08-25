// lib/billing-server.js
import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Idempotent per (provider, providerRef). For PayMongo, providerRef is a
// one-time payment id — a retried webhook just re-writes the same row.
// For Dodo, providerRef is the SUBSCRIPTION id — the SAME ref fires again
// on every monthly renewal, and each one should genuinely extend
// current_period_end, not be ignored. Plain upsert (update-on-conflict)
// handles both correctly; the earlier ignoreDuplicates version didn't.
export async function activateSubscription({ userId, provider, providerRef, periodDays = 30 }) {
  const periodEnd = new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000).toISOString();

  const { error: subError } = await supabaseAdmin
    .from('subscriptions')
    .upsert(
      { user_id: userId, provider, provider_ref: providerRef, status: 'active', current_period_end: periodEnd, updated_at: new Date().toISOString() },
      { onConflict: 'provider,provider_ref' }
    );
  if (subError) throw new Error(`subscriptions upsert failed: ${subError.message}`);

  const { error: profileError } = await supabaseAdmin.from('profiles').update({ plan: 'pro' }).eq('id', userId);
  if (profileError) throw new Error(`profiles update failed: ${profileError.message}`);
}

// New: explicit downgrade for a cancelled subscription or a failed renewal
// charge. Checks for another still-active subscription before downgrading —
// so cancelling Dodo doesn't kill Pro access someone separately paid for via
// PayMongo.
export async function deactivateSubscription({ userId, provider, providerRef }) {
  const { error: subError } = await supabaseAdmin
    .from('subscriptions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('provider', provider)
    .eq('provider_ref', providerRef);
  if (subError) throw new Error(`subscriptions cancel failed: ${subError.message}`);

  const { data: stillActive } = await supabaseAdmin
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gt('current_period_end', new Date().toISOString())
    .limit(1);

  if (!stillActive?.length) {
    const { error: profileError } = await supabaseAdmin.from('profiles').update({ plan: 'free' }).eq('id', userId);
    if (profileError) throw new Error(`profiles downgrade failed: ${profileError.message}`);
  }
}