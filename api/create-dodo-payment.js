// api/create-dodo-payment.js
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, email } = req.body;
  console.log('[DODO] Received request for userId:', userId, 'email:', email);

  if (!userId) {
    console.error('[DODO] Missing userId');
    return res.status(400).json({ error: 'Missing userId' });
  }

  // Read environment variables
  const apiKey = process.env.DODO_PAYMENTS_API_KEY;
  const productId = process.env.DODO_PRODUCT_ID;

  console.log('[DODO] API key exists?', !!apiKey);
  console.log('[DODO] Product ID exists?', !!productId);
  console.log('[DODO] Product ID value:', productId);

  if (!apiKey || !productId) {
    console.error('[DODO] Missing credentials');
    return res.status(500).json({ error: 'Server misconfigured: missing API key or product ID' });
  }

  try {
    // Build request body according to Dodo Payments API (adjust fields to their spec)
    const requestBody = {
      product_cart: [
        {
          product_id: productId,
          quantity: 1
        }
      ],
      success_url: 'https://vaibes.pro/app?upgrade=success',
      cancel_url: 'https://vaibes.pro/app?upgrade=cancel',
      metadata: { userId: userId.toString() },
      customer_email: email || undefined
    };

    console.log('[DODO] Sending request to Dodo API with body:', JSON.stringify(requestBody, null, 2));

    // Make the API call – double‑check the endpoint URL from Dodo docs
    const response = await fetch('https://api.dodopayments.com/v1/checkouts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    const responseText = await response.text();
    console.log('[DODO] Response status:', response.status);
    console.log('[DODO] Response body:', responseText);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('[DODO] Failed to parse JSON:', e);
      data = { error: responseText };
    }

    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || data.error || 'Dodo API error' });
    }

    const checkoutUrl = data.checkout_url || data.url;
    if (!checkoutUrl) {
      console.error('[DODO] No checkout URL in response', data);
      return res.status(500).json({ error: 'No checkout URL returned' });
    }

    console.log('[DODO] Success, checkout URL:', checkoutUrl);
    return res.status(200).json({ url: checkoutUrl });
  } catch (error) {
    console.error('[DODO] Fatal error:', error.message, error.stack);
    return res.status(500).json({ error: error.message });
  }
}