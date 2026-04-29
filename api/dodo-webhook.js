// api/dodo-webhook.js
import { supabase } from '../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const payload = req.body;
  console.log('Webhook received:', payload);

  // Dodo webhook events – adjust field names based on actual Dodo payload
  const eventType = payload.event || payload.type;
  const isSuccessful = 
    eventType === 'payment.succeeded' ||
    eventType === 'checkout.completed' ||
    payload.data?.status === 'paid';

  if (!isSuccessful) {
    // Not a successful payment – ignore
    return res.status(200).json({ received: true, ignored: true });
  }

  // Extract metadata (where we stored userId and plan)
  const metadata = payload.data?.metadata || payload.metadata || {};
  const userId = metadata.userId || metadata.user_id;
  const plan = metadata.plan || 'pro'; // default to 'pro'

  if (!userId) {
    console.error('No userId found in webhook payload:', payload);
    return res.status(200).json({ received: true, error: 'No userId in metadata' });
  }

  console.log(`Upgrading user ${userId} to ${plan} via Dodo webhook`);

  // Use service key to bypass RLS
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('Missing Supabase URL or service key');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  try {
    const updateRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          plan: plan,          // 'pro'
          upgraded_at: new Date().toISOString()
        })
      }
    );

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      console.error('Supabase update failed:', errText);
      return res.status(500).json({ error: errText });
    }

    console.log(`✅ Successfully upgraded user ${userId} to ${plan}`);
    return res.status(200).json({ success: true, upgraded: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: error.message });
  }
}