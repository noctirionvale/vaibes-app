export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const payload = req.body
  console.log('Webhook received:', JSON.stringify(payload))

  // ✅ Verify webhook signature
  const webhookSecret = process.env.DODO_WEBHOOK_SECRET
  if (webhookSecret) {
    try {
      const webhookId = req.headers['webhook-id']
      const webhookTimestamp = req.headers['webhook-timestamp']
      const webhookSignature = req.headers['webhook-signature']

      if (!webhookId || !webhookTimestamp || !webhookSignature) {
        console.warn('Missing webhook headers — skipping verification')
      } else {
        // Signature verification using standardwebhooks spec
        const signedContent = `${webhookId}.${webhookTimestamp}.${JSON.stringify(payload)}`
        const crypto = await import('crypto')
        const secretBytes = Buffer.from(webhookSecret.replace('whsec_', ''), 'base64')
        const hmac = crypto.createHmac('sha256', secretBytes)
        hmac.update(signedContent)
        const computedSignature = `v1,${hmac.digest('base64')}`
        const signatures = webhookSignature.split(' ')
        const isValid = signatures.some(sig => sig === computedSignature)
        if (!isValid) {
          console.error('Invalid webhook signature')
          return res.status(401).json({ error: 'Invalid signature' })
        }
      }
    } catch (err) {
      console.warn('Signature verification error:', err.message)
    }
  }

  // ✅ Dodo event types
  const eventType = payload.type || payload.event_type || payload.event
  console.log('Event type:', eventType)

  const isSuccessful =
    eventType === 'payment.succeeded' ||
    eventType === 'payment.paid' ||
    eventType === 'checkout.completed' ||
    payload?.data?.payment_status === 'succeeded' ||
    payload?.data?.status === 'paid'

  if (!isSuccessful) {
    console.log('Ignoring non-payment event:', eventType)
    return res.status(200).json({ received: true, ignored: true })
  }

  // ✅ Extract userId from metadata
  const metadata =
    payload?.data?.metadata ||
    payload?.metadata ||
    {}

  const userId = metadata.userId || metadata.user_id
  const plan = metadata.plan || 'pro'

  if (!userId) {
    console.error('No userId in metadata:', JSON.stringify(payload))
    return res.status(200).json({ received: true, error: 'No userId' })
  }

  console.log(`Upgrading user ${userId} to ${plan}`)

  const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error('Missing Supabase credentials')
    return res.status(500).json({ error: 'Server misconfigured' })
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
          plan,
          upgraded_at: new Date().toISOString()
        })
      }
    )

    if (!updateRes.ok) {
      const errText = await updateRes.text()
      console.error('Supabase update failed:', errText)
      return res.status(500).json({ error: errText })
    }

    console.log(`✅ User ${userId} upgraded to ${plan}`)
    return res.status(200).json({ success: true })

  } catch (error) {
    console.error('Webhook error:', error)
    return res.status(500).json({ error: error.message })
  }
}