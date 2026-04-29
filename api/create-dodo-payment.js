// api/create-dodo-payment.js
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { userId, email } = req.body;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  // Get environment variables
  const DODO_API_KEY = process.env.DODO_PAYMENTS_API_KEY;
  const PRODUCT_ID = process.env.DODO_PRODUCT_ID;          // Your Pro plan product ID
  const RETURN_URL = process.env.DODO_PAYMENTS_RETURN_URL || 'https://vaibes.pro/app?upgrade=success';
  const CANCEL_URL = process.env.DODO_PAYMENTS_CANCEL_URL || 'https://vaibes.pro/app?upgrade=cancel';

  if (!DODO_API_KEY || !PRODUCT_ID) {
    console.error('Missing Dodo API key or Product ID');
    return res.status(500).json({ error: 'Server misconfigured: missing Dodo credentials' });
  }

  try {
    const response = await fetch('https://api.dodopayments.com/v1/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DODO_API_KEY}`
      },
      body: JSON.stringify({
        product_id: PRODUCT_ID,
        success_url: RETURN_URL,
        cancel_url: CANCEL_URL,
        metadata: {
          userId: userId,
          plan: 'pro'
        },
        customer_email: email || undefined,
        quantity: 1
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Dodo API error:', data);
      return res.status(500).json({ error: 'Failed to create payment link' });
    }

    // Dodo returns a checkout URL – field name may be 'checkout_url' or 'url'
    const checkoutUrl = data.checkout_url || data.url;
    if (!checkoutUrl) {
      console.error('No checkout URL in Dodo response:', data);
      return res.status(500).json({ error: 'Invalid response from payment provider' });
    }

    return res.status(200).json({ url: checkoutUrl });

  } catch (error) {
    console.error('Payment creation error:', error);
    return res.status(500).json({ error: error.message });
  }
}