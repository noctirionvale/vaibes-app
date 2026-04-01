const rateLimitTracker = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ✨ NEW: The VIP Email Bypass Check
  // We grab the userEmail that the frontend will send us in the request body
  const userEmail = req.body.userEmail;
  
  // If the email matches yours, isAdmin becomes true and skips the rate limiter!
  const isAdmin = userEmail === 'noctirionvale@gmail.com';

  // 2. THE CAPPING LOGIC (Only runs if you are NOT the admin)
  if (!isAdmin) {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
    const currentTime = Date.now();
    const timeWindowMs = 60 * 1000; 
    const maxRequests = 3; 

    if (rateLimitTracker.has(ip)) {
      const userStats = rateLimitTracker.get(ip);
      if (currentTime - userStats.startTime < timeWindowMs) {
        if (userStats.count >= maxRequests) {
          return res.status(429).json({ 
            error: "You're moving too fast! Please wait a minute before sending another request." 
          });
        }
        userStats.count++; 
      } else {
        rateLimitTracker.set(ip, { count: 1, startTime: currentTime });
      }
    } else {
      rateLimitTracker.set(ip, { count: 1, startTime: currentTime });
    }
  }

  // 3. SECURE CALL TO DEEPSEEK
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
    });

    const data = await apiResponse.json();
    
    if (apiResponse.ok) {
      return res.status(200).json(data);
    } else {
      return res.status(apiResponse.status).json({ error: data });
    }
    
  } catch (error) {
    console.error("Backend Error:", error);
    return res.status(500).json({ error: "Failed to connect to AI server." });
  }
}