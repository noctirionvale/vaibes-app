// api/paymongo-webhook.js
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// Vercel parses JSON automatically unless told not to — but signature
// verification needs the exact raw bytes PayMongo signed.
export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

// Per PayMongo's current spec: header is `t=<ts>,te=<test_sig>,li=<live_sig>`.
function verifySignature(rawBody, signatureHeader, webhookSecret) {
  if (!signatureHeader) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(',').map(p => p.split('=').map(s => s.trim()))
  );
  const { t: timestamp, te: testSig, li: liveSig } = parts;
  if (!timestamp) return false;

  // Replay-attack guard — reject anything older than 5 minutes
  const ageMs = Date.now() - Number(timestamp) * 1000;
  if (!Number.isFinite(ageMs) || ageMs > 5 * 60 * 1000 || ageMs < -60 * 1000) return false;

  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  const candidates = [testSig, liveSig].filter(Boolean);
  return candidates.some(sig => {
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await readRawBody(req);
  const signatureHeader = req.headers['paymongo-signature'];
  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('❌ PAYMONGO_WEBHOOK_SECRET not configured');
    return res.status(500).end();
  }

  if (!verifySignature(rawBody, signatureHeader, webhookSecret)) {
    console.error('❌ PayMongo webhook signature verification failed');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const eventType = event?.data?.attributes?.type;

  // Return 200 fast for anything we don't act on
  if (eventType !== 'link.payment.paid') {
    return res.status(200).json({ received: true, ignored: eventType });
  }

  try {
    const resource = event.data.attributes.data;
    const remarks = resource?.attributes?.remarks || '';
    const paymentId = resource?.id; // e.g., 'lin_xxxx'
    
    const userIdMatch = remarks.match(/userId:([^|]+)/);
    const userId = userIdMatch?.[1];

    if (!userId || !paymentId) {
      console.error('❌ Missing userId or paymentId:', remarks, paymentId);
      return res.status(200).json({ received: true, error: 'missing data' });
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // ── IDEMPOTENCY GUARD ─────────────────────────────────────────
    // Prevents double-granting if PayMongo retries the webhook delivery.
    const { data: existingTx } = await supabaseAdmin
      .from('payment_transactions')
      .select('provider_ref')
      .eq('provider_ref', paymentId)
      .maybeSingle();

    if (existingTx) {
      console.log(`ℹ️ Payment ${paymentId} already processed. Ignoring retry.`);
      return res.status(200).json({ received: true, ignored: 'already_processed' });
    }

    // ── GRANT CREDITS ─────────────────────────────────────────────
    const { error: grantError } = await supabaseAdmin.rpc('grant_ai_credits', {
      p_user_id: userId,
      p_amount: 50
    });

    if (grantError) throw grantError;

    // ── RECORD TRANSACTION ────────────────────────────────────────
    const { error: txError } = await supabaseAdmin.from('payment_transactions').insert({
      provider_ref: paymentId,
      user_id: userId,
      provider: 'paymongo',
      credits_granted: 50
    });

    if (txError && txError.code !== '23505') { 
      // 23505 is duplicate key, which is fine (means another instance just handled it)
      console.warn('⚠️ Failed to record transaction, but credits were granted:', txError);
    }

    // ── UPDATE PROFILE PLAN FLAG ──────────────────────────────────
    // So BillingPanel.jsx and Edufeed.jsx correctly show the "Pro" badge.
    await supabaseAdmin
      .from('profiles')
      .update({ plan: 'pro', updated_at: new Date().toISOString() })
      .eq('id', userId);

    console.log(`✅ Granted 50 credits to ${userId} for payment ${paymentId}`);
    return res.status(200).json({ received: true, granted: true });
    
  } catch (err) {
    console.error('❌ PayMongo webhook processing error:', err.message);
    
    // Changed to 500: Because we have an idempotency guard, returning 500 is 
    // actually safe and desired. PayMongo will retry up to 12 times, acting as 
    // a free queue system if your DB was temporarily unreachable. The guard 
    // ensures the retry won't grant credits a second time.
    return res.status(500).json({ received: false, error: err.message }); 
  }
}