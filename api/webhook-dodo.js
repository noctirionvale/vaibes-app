// api/webhook-dodo.js
import DodoPayments from 'dodopayments';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

const client = new DodoPayments({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY,
  webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_SECRET,
  environment: process.env.DODO_ENVIRONMENT || 'live_mode',
});

// Events that indicate money changed hands -> GRANT CREDITS
const CREDIT_GRANT_EVENTS = [
  'payment.succeeded',      // One-off ₱99 pack
  'subscription.active',    // Initial subscription charge
  'subscription.renewed'    // Monthly subscription renewal
];

// Events indicating cancellation/failure -> DOWNGRADE UI FLAG
const DOWNGRADE_EVENTS = [
  'subscription.cancelled',
  'subscription.expired',
  'payment.failed',
  'charge.failed'
];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await readRawBody(req);
  let event;

  try {
    event = client.webhooks.unwrap(rawBody, {
      'webhook-id': req.headers['webhook-id'],
      'webhook-timestamp': req.headers['webhook-timestamp'],
      'webhook-signature': req.headers['webhook-signature'],
    });
  } catch (err) {
    console.error('❌ Dodo webhook signature verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const eventType = event?.type || event?.event_type;
  const data = event?.data || {};
  
  const userId = data.metadata?.userId;
  
  // ⚠️ SENIOR DEV CATCH: Prioritize `payment_id` over `subscription_id`.
  // If a user subscribes, Dodo sends `subscription.renewed` every month.
  // The `subscription_id` stays the same, but `payment_id` changes per charge.
  // Using `payment_id` ensures our idempotency guard allows monthly renewals.
  const providerRef = data.payment_id || data.subscription_id || data.id;

  if (!userId) {
    console.error('❌ No userId in Dodo webhook metadata:', JSON.stringify(data).slice(0, 500));
    return res.status(200).json({ received: true, error: 'missing userId in metadata' });
  }

  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // ── 1. CREDIT GRANTING (One-off & Renewals) ───────────────────
    if (CREDIT_GRANT_EVENTS.includes(eventType)) {
      if (!providerRef) {
        console.error('❌ Missing payment_id/subscription_id for idempotency guard.');
        return res.status(200).json({ received: true, error: 'missing provider ref' });
      }

      // IDEMPOTENCY GUARD
      const { data: existingTx } = await supabaseAdmin
        .from('payment_transactions')
        .select('provider_ref')
        .eq('provider_ref', providerRef)
        .eq('provider', 'dodo')
        .maybeSingle();

      if (existingTx) {
        console.log(`ℹ️ Dodo event ${providerRef} already processed. Ignoring retry.`);
        return res.status(200).json({ received: true, ignored: 'already_processed' });
      }

      // GRANT CREDITS
      const { error: grantError } = await supabaseAdmin.rpc('grant_ai_credits', {
        p_user_id: userId,
        p_amount: 50 
      });

      if (grantError) throw grantError;

      // RECORD TRANSACTION
      const { error: txError } = await supabaseAdmin.from('payment_transactions').insert({
        provider_ref: providerRef,
        user_id: userId,
        provider: 'dodo',
        credits_granted: 50
      });

      if (txError && txError.code !== '23505') {
        console.warn('⚠️ Failed to record Dodo transaction, but credits were granted:', txError);
      }

      // UPDATE PLAN FLAG (UI Sync)
      await supabaseAdmin
        .from('profiles')
        .update({ plan: 'pro', updated_at: new Date().toISOString() })
        .eq('id', userId);

      console.log(`✅ Dodo: Granted 50 credits to ${userId} for ${eventType} (${providerRef})`);
    } 
    
    // ── 2. PLAN DOWNGRADE (Cancellations/Failures) ────────────────
    else if (DOWNGRADE_EVENTS.includes(eventType)) {
      // We do NOT touch the credit wallet. If they have 10 credits left, 
      // they can still use them. We just flip the UI badge back to 'free' 
      // so the Edufeed/BillingPanel shows the upgrade prompt again.
      await supabaseAdmin
        .from('profiles')
        .update({ plan: 'free', updated_at: new Date().toISOString() })
        .eq('id', userId);

      console.log(`ℹ️ Dodo: Downgraded UI plan flag for ${userId} due to ${eventType}`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('❌ Dodo webhook processing error:', err.message);
    // 500 allows Dodo to retry. Our DB idempotency guard ensures retries are safe.
    return res.status(500).json({ received: false, error: err.message }); 
  }
}