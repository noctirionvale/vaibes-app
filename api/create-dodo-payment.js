export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { userId, email } = req.body
  if (!userId) return res.status(400).json({ error: 'Missing userId' })

  const apiKey = process.env.DODO_PAYMENTS_API_KEY
  const productId = process.env.DODO_PRODUCT_ID

  if (!apiKey || !productId) {
    console.error('Missing Dodo credentials')
    return res.status(500).json({ error: 'Missing Dodo credentials' })
  }

  try {
    // ✅ Live mode endpoint
    const response = await fetch('https://live.dodopayments.com/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        payment_link: true,
        billing: {
          city: 'Manila',
          country: 'PH',
          state: 'Metro Manila',
          street: 'N/A',
          zipcode: 1000
        },
        customer: {
          email: email || 'user@vaibes.pro',
          name: 'vAIbes User',
          create_new_customer: true
        },
        // ✅ Correct field name
        product_cart: [
          {
            product_id: productId,
            quantity: 1
          }
        ],
        metadata: {
          userId,
          plan: 'pro'
        },
        return_url: 'https://vaibes.pro/app?upgrade=success'
      })
    })

    const data = await response.json()
    console.log('Dodo status:', response.status)
    console.log('Dodo response:', JSON.stringify(data))

    if (!response.ok) {
      return res.status(500).json({
        error: data.message || data.error || 'Dodo API error',
        details: data
      })
    }

    // ✅ Dodo returns payment_link
    const checkoutUrl = data.payment_link || data.checkout_url || data.url

    if (!checkoutUrl) {
      console.error('No checkout URL:', data)
      return res.status(500).json({ error: 'No checkout URL returned', response: data })
    }

    return res.status(200).json({ url: checkoutUrl })

  } catch (error) {
    console.error('Payment error:', error)
    return res.status(500).json({ error: error.message })
  }
}