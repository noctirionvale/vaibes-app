export default async function handler(req, res) {
  // ... CORS and method check ...

  const { userId, email } = req.body;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  const apiKey = process.env.DODO_PAYMENTS_API_KEY;
  const productId = process.env.DODO_PRODUCT_ID;

  console.log('DODO_PAYMENTS_API_KEY exists?', !!apiKey);
  console.log('DODO_PRODUCT_ID exists?', !!productId);

  if (!apiKey || !productId) {
    console.error('Missing Dodo credentials');
    return res.status(500).json({ error: 'Server misconfigured: missing API key or product ID' });
  }

  try {
    const response = await fetch('https://api.dodopayments.com/v1/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        product_id: productId,
        success_url: 'https://vaibes.pro/app?upgrade=success',
        cancel_url: 'https://vaibes.pro/app?upgrade=cancel',
        metadata: { userId },
        customer_email: email || undefined,
        quantity: 1
      })
    });

    const data = await response.json();
    console.log('Dodo response status:', response.status);
    console.log('Dodo response body:', data);

    if (!response.ok) {
      return res.status(500).json({ error: data.message || 'Dodo API error' });
    }

    const checkoutUrl = data.checkout_url || data.url;
    if (!checkoutUrl) {
      return res.status(500).json({ error: 'No checkout URL returned' });
    }

    return res.status(200).json({ url: checkoutUrl });
  } catch (error) {
    console.error('Payment creation error:', error);
    return res.status(500).json({ error: error.message });
  }
}