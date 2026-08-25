// api/create-dodo-checkout.js
import DodoPayments from 'dodopayments';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  
  res.setHeader('Access-Control-Allow-Origin', clientUrl);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  // ── SECURITY FIX: Enforce Auth & Extract verified User ID ──────
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

  // Ignore req.body.userId entirely. Trust the JWT.
  const userId = user.id;
  const email = user.email;

  const apiKey = process.env.DODO_PAYMENTS_API_KEY;
  const productId = process.env.DODO_PRO_PRODUCT_ID;
  
  if (!apiKey) return res.status(500).json({ error: 'Server misconfiguration: Missing API key.' });
  if (!productId) return res.status(500).json({ error: 'Server misconfiguration: Missing Product ID.' });

  const client = new DodoPayments({
    bearerToken: apiKey,
    environment: process.env.DODO_ENVIRONMENT || 'live_mode',
  });

  try {
    const session = await client.checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: email ? { email } : undefined,
      // Pass the cryptographically verified userId into metadata
      metadata: { userId },
      // Dynamic URL ensures localhost/preview environments route back correctly
      return_url: `${clientUrl}/app?payment=success`, 
    });

    return res.status(200).json({ url: session.checkout_url });
  } catch (error) {
    // Log the raw error server-side, but don't leak it to the client
    console.error('❌ Dodo checkout creation error:', error);
    return res.status(500).json({ error: 'Failed to create checkout session. Please try again.' });
  }
}