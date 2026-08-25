// api/create-payment.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { userId, email } = req.body;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

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
            amount: 9900, // FIX: 9900 centavos = PHP 99.00 (was 19900)
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