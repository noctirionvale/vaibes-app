// api/submit-gcash-payment.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  res.setHeader('Access-Control-Allow-Origin', clientUrl);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid auth token.' });
  }
  const token = authHeader.split(' ')[1];

  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }

  const { referenceNumber } = req.body || {};
  const cleanRef = typeof referenceNumber === 'string' ? referenceNumber.trim() : '';

  if (!cleanRef || cleanRef.length < 6 || cleanRef.length > 40) {
    return res.status(400).json({
      error: 'Enter the reference number GCash showed you after sending the payment.'
    });
  }

  // Soft anti-spam: block a new claim while this user already has one
  // waiting on review, so someone can't flood the queue with junk
  // reference numbers while a real claim sits buried in the list.
  const { count: pendingCount, error: countError } = await supabaseAdmin
    .from('manual_payment_claims')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'pending');

  if (countError) {
    console.error('❌ pending-count check error:', countError);
    return res.status(500).json({ error: 'Could not submit your claim. Please try again.' });
  }
  if (pendingCount >= 3) {
    return res.status(429).json({
      error: 'You already have payment claims waiting on review. Please wait for those to be checked first.'
    });
  }

  const { data, error } = await supabaseAdmin
    .from('manual_payment_claims')
    .insert({
      user_id: user.id,
      reference_number: cleanRef,
      amount_php: 99.00,
      credits_requested: 50
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        error: 'That reference number has already been submitted. If this is a mistake, contact support.'
      });
    }
    console.error('❌ submit-gcash-payment error:', error);
    return res.status(500).json({ error: 'Could not submit your claim. Please try again.' });
  }

  return res.status(200).json({
    success: true,
    message: "Thanks — we'll verify your payment and add your credits shortly.",
    claimId: data.id
  });
}