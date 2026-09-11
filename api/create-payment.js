// api/create-payment.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  // 🔒 FIXED: this used to trust a client-supplied userId/email straight
  // from the request body — anyone could pass any userId and misattribute
  // a payment to a different account. BillingPanel.jsx already stopped
  // sending them (see its "Removed userId/email - backend extracts from
  // JWT" comment) and sends a Bearer token instead, but this endpoint was
  // never updated to actually read it — hence "Missing userId": the body
  // really is empty now, and nothing here was deriving the user from the
  // verified token.
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
  }

  const userId = user.id;
  const email = user.email;

  const secretKey = process.env.PAYMONGO_SECRET_KEY;
  if (!secretKey) return res.status(500).json({ error: 'Missing PayMongo secret key' });

  try {
    const response = await fetch('https://api.paymongo.com/v1/links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(secretKey + ':').toString('base64')
      },
      body: JSON.stringify({
        data: {
          attributes: {
            amount: 9900, // 9900 centavos = PHP 99.00
            description: 'vAIbes Pro Plan - 50 AI Credits',
            remarks: `userId:${userId}|plan:pro|email:${email || ''}`
          }
        }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('PayMongo error:', data);
      return res.status(500).json({ error: 'Failed to create payment link' });
    }

    return res.status(200).json({ url: data.data.attributes.checkout_url });
  } catch (error) {
    console.error('Payment creation error:', error);
    return res.status(500).json({ error: error.message });
  }
}