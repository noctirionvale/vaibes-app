export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  try {
    const response = await fetch('https://api.paymongo.com/v1/links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(process.env.PAYMONGO_SECRET_KEY + ':').toString('base64')
      },
      body: JSON.stringify({
        data: {
          attributes: {
            amount: 19900, // ₱199.00 in centavos
            description: 'vAIbes Pro Plan - Monthly',
            remarks: 'userId:' + userId + '|plan:pro'
          }
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('PayMongo error:', data);
      return res.status(500).json({ error: 'Failed to create payment link' });
    }

    const checkoutUrl = data.data.attributes.checkout_url;
    return res.status(200).json({ url: checkoutUrl });

  } catch (error) {
    console.error('Payment creation error:', error);
    return res.status(500).json({ error: error.message });
  }
}