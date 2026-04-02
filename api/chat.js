import { createClient } from '@supabase/supabase-js'

const rateLimitTracker = new Map()

// Server-side Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ADMIN_EMAIL = 'noctirionvale@gmail.com'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // ✅ SECURE: Verify user via Authorization header token
  // NOT from req.body — that can be faked
  let isAdmin = false
  let isPro = false

  const authHeader = req.headers['authorization']

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1]

    // Verify the token with Supabase server-side
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (!error && user) {
      // Check if admin
      isAdmin = user.email === ADMIN_EMAIL

      // Check if pro user
      if (!isAdmin) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('plan, request_count')
          .eq('id', user.id)
          .single()

        isPro = profile?.plan === 'pro'
      }
    }
  }

  // Rate limiting — skip for admin and pro users
  if (!isAdmin && !isPro) {
    const ip = req.headers['x-forwarded-for']
      || req.connection?.remoteAddress
      || 'unknown'

    const currentTime = Date.now()
    const timeWindowMs = 24 * 60 * 60 * 1000 // 24 hours
    const maxRequests = 3

    if (rateLimitTracker.has(ip)) {
      const userStats = rateLimitTracker.get(ip)
      if (currentTime - userStats.startTime < timeWindowMs) {
        if (userStats.count >= maxRequests) {
          return res.status(429).json({
            error: 'Daily limit reached. Upgrade to Pro for unlimited access.',
            code: 'LIMIT_REACHED'
          })
        }
        userStats.count++
      } else {
        rateLimitTracker.set(ip, { count: 1, startTime: currentTime })
      }
    } else {
      rateLimitTracker.set(ip, { count: 1, startTime: currentTime })
    }
  }

  // Secure DeepSeek call
  try {
    const apiResponse = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: req.body.messages,
        temperature: 0.7
      })
    })

    const data = await apiResponse.json()

    if (apiResponse.ok) {
      return res.status(200).json(data)
    } else {
      return res.status(apiResponse.status).json({ error: data })
    }

  } catch (error) {
    console.error('Backend Error:', error)
    return res.status(500).json({ error: 'Failed to connect to AI server.' })
  }
}