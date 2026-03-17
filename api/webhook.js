import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const event = req.body;

    // Only handle successful payments
    if (event?.data?.attributes?.type !== 'payment.paid') {
      return res.status(200).json({ received: true });
    }

    const remarks = event?.data?.attributes?.data?.attributes?.remarks || '';

    // Extract userId from remarks — format: "userId:xxx|plan:pro"
    const userIdMatch = remarks.match(/userId:([^\|]+)/);
    const planMatch = remarks.match(/plan:(\w+)/);

    if (!userIdMatch || !planMatch) {
      console.log('No userId or plan in remarks');
      return res.status(200).json({ received: true });
    }

    const userId = userIdMatch[1];
    const plan = planMatch[1];

    // Upgrade user tier in Supabase
    const { error } = await supabase
      .from('profiles')
      .update({
        tier: plan,
        upgraded_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      console.error('Supabase update error:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log('✅ Upgraded user', userId, 'to', plan);
    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: error.message });
  }
}
```

---

## Step 3 — Add `SUPABASE_SERVICE_KEY` to Vercel

This is different from the anon key — it's the **service role key** that bypasses RLS for admin operations.

Go to **Supabase → Project Settings → API → service_role key** → copy it.

Add to Vercel env vars:
```
SUPABASE_SERVICE_KEY=your_service_role_key