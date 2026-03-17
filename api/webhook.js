export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const event = req.body;
    console.log('Webhook received:', JSON.stringify(event?.data?.attributes?.type));

    // Handle payment paid event
    const eventType = event?.data?.attributes?.type;
    if (eventType !== 'payment.paid' && eventType !== 'link.payment.paid') {
      return res.status(200).json({ received: true });
    }

    // Get remarks from the payment
    const attributes = event?.data?.attributes?.data?.attributes;
    const remarks = attributes?.remarks || 
                   event?.data?.attributes?.remarks || '';

    console.log('Remarks:', remarks);

    const userIdMatch = remarks.match(/userId:([^\|]+)/);
    const planMatch = remarks.match(/plan:(\w+)/);

    if (!userIdMatch || !planMatch) {
      console.log('No userId or plan found in remarks:', remarks);
      return res.status(200).json({ received: true });
    }

    const userId = userIdMatch[1].trim();
    const plan = planMatch[1].trim();

    console.log('Upgrading user:', userId, 'to plan:', plan);

    // Use service key to bypass RLS
    const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;

    const updateRes = await fetch(
      supabaseUrl + '/rest/v1/profiles?id=eq.' + userId,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceKey,
          'Authorization': 'Bearer ' + serviceKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          tier: plan,
          upgraded_at: new Date().toISOString()
        })
      }
    );

    if (!updateRes.ok) {
      const err = await updateRes.text();
      console.error('Supabase update failed:', err);
      return res.status(500).json({ error: err });
    }

    console.log('✅ Successfully upgraded user', userId, 'to', plan);
    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: error.message });
  }
}