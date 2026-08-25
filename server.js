const express = require('express');
const cors    = require('cors');
const path    = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const { YoutubeTranscript } = require('youtube-transcript');

// ── Validate required env vars BEFORE anything else ──
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DEEPSEEK_API_KEY'
];

const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.error('❌ FATAL: Missing required environment variables:');
  missingVars.forEach(v => console.error(`   - ${v}`));
  console.error('\nMake sure your .env file exists at:', path.resolve(__dirname, '.env'));
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const PORT = process.env.PORT || 5000;

// Supabase Admin Client
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ADMIN_EMAIL = 'noctirionvale@gmail.com';

// ── Cost-control knobs ──────────────────────────────────────────
// Credits are now the whole access model (see checkUsage below) —
// there's no separate "pro plan" gate anymore. A user either has
// credits or they don't. Layer subscriptions back on top later by
// having a cron job call grant_ai_credits() monthly for subscribers.
const RATE_LIMIT_PER_MINUTE = 10;   // abuse guard, independent of credit balance
const MAX_OUTPUT_TOKENS       = 1000; // /api/ai chat
const MAX_OUTPUT_TOKENS_SHORT = 800;  // /api/compare (3-perspective answers)
const MAX_OUTPUT_TOKENS_QUIZ  = 2000; // /api/generate-quiz-from-notes (multi-question JSON)
const MAX_INPUT_CHARS = 24000;      // ~6k tokens at a rough 4 chars/token — DeepSeek bills input too

console.log('🚀 Server starting...');
console.log('📝 DeepSeek API Key loaded:', !!DEEPSEEK_API_KEY);
console.log('📊 Supabase URL:', process.env.SUPABASE_URL?.substring(0, 30) + '...');

/* ══════════════════════════════════════════════════════════════
   SHARED FUNCTION: Fetch Vaibey Context (Error-Tolerant)
   ══════════════════════════════════════════════════════════════ */
async function fetchVaibeyContext(userId, contextType = 'full', limit = 50) {
  try {
    const context = {
      userId,
      fetchedAt: new Date().toISOString(),
      notes: [],
      quizHistory: [],
      studyTopics: [],
      recentActivity: [],
      weakAreas: [],
      strongAreas: [],
      streak: 0,
      badges: [],
      messages: []
    };

    // ── Fetch Creative Wall notes ──
    if (contextType === 'full' || contextType === 'notes') {
      try {
        const { data: notes, error } = await supabaseAdmin
          .from('user_creatives')
          .select('id, title, content, subject, created_at, media_type')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (!error && notes) context.notes = notes;
      } catch (err) {
        console.warn('⚠️ Notes fetch skipped (table may not exist):', err.message);
      }
    }

    // ── Fetch Quiz History ──
    if (contextType === 'full' || contextType === 'quiz') {
      try {
        const { data: quizzes, error } = await supabaseAdmin
          .from('user_quiz_results')
          .select('*')
          .eq('user_id', userId)
          .order('attempted_at', { ascending: false })
          .limit(limit);

        if (!error && quizzes) {
          context.quizHistory = quizzes;
          context.weakAreas = [...new Set(quizzes.filter(q => !q.is_correct && q.topic).map(q => q.topic))];
          context.strongAreas = [...new Set(quizzes.filter(q => q.is_correct && q.topic).map(q => q.topic))];
        }
      } catch (err) {
        console.warn('⚠️ Quiz history fetch skipped (table may not exist):', err.message);
      }
    }

    // ── Fetch Study Topics from activity log ──
    if (contextType === 'full' || contextType === 'topics') {
      try {
        const { data: activity, error } = await supabaseAdmin
          .from('user_activity_log')
          .select('subject, activity_type, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(limit * 2);

        if (!error && activity) {
          context.studyTopics = [...new Set(activity.filter(a => a.subject).map(a => a.subject))];
          context.recentActivity = activity.slice(0, 20);
        }
      } catch (err) {
        console.warn('⚠️ Activity log fetch skipped (table may not exist):', err.message);
      }
    }

    // ── Fetch Study Streak ──
    if (contextType === 'full' || contextType === 'streak') {
      try {
        const { data: streak, error } = await supabaseAdmin
          .from('user_study_streaks')
          .select('current_streak, longest_streak, last_study_date')
          .eq('user_id', userId)
          .maybeSingle();

        if (!error && streak) {
          context.streak = streak.current_streak || 0;
          context.longestStreak = streak.longest_streak || 0;
          context.lastStudyDate = streak.last_study_date;
        }
      } catch (err) {
        console.warn('⚠️ Streak fetch skipped (table may not exist):', err.message);
      }
    }

    // ── Fetch Recent Messages ──
    if (contextType === 'full' || contextType === 'messages') {
      try {
        const { data: messages, error } = await supabaseAdmin
          .from('direct_messages')
          .select('content, created_at, sender_id')
          .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
          .order('created_at', { ascending: false })
          .limit(20);

        if (!error && messages) context.messages = messages;
      } catch (err) {
        console.warn('⚠️ Messages fetch skipped (table may not exist):', err.message);
      }
    }

    // ── Fetch User Badges ──
    if (contextType === 'full' || contextType === 'badges') {
      try {
        const { data: badges, error } = await supabaseAdmin
          .from('user_badges')
          .select('*')
          .eq('user_id', userId)
          .order('earned_at', { ascending: false });

        if (!error && badges) context.badges = badges;
      } catch (err) {
        console.warn('⚠️ Badges fetch skipped (table may not exist):', err.message);
      }
    }

    // ── Generate summary ──
    context.summary = {
      totalNotes: context.notes.length,
      totalQuizzes: context.quizHistory.length,
      accuracyRate: context.quizHistory.length > 0
        ? Math.round((context.quizHistory.filter(q => q.is_correct).length / context.quizHistory.length) * 100)
        : 0,
      weakTopics: context.weakAreas.slice(0, 5),
      strongTopics: context.strongAreas.slice(0, 5),
      currentStreak: context.streak,
      badgesCount: context.badges.length
    };

    return { success: true, context };
  } catch (error) {
    console.error('❌ Vaibey context error:', error);
    return { success: false, error: error.message, context: null };
  }
}

/* ══════════════════════════════════════════════════════════════
   MIDDLEWARE: Credit-based auth + reservation
   ══════════════════════════════════════════════════════════════
   Reserves 1 credit AND enforces the per-minute rate limit BEFORE
   the AI call, in a single Postgres round trip (see
   consume_ai_credit in supabase/credits_schema.sql). That's what
   keeps two concurrent requests from the same user from both
   reading "1 credit left" and both going through — a check-then-
   deduct in plain JS has a race window that a DB row lock closes.

   If the AI call itself then fails, the route handler calls
   refundCredit() so a failed generation doesn't cost the user
   anything.
   ══════════════════════════════════════════════════════════════ */
const checkUsage = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing auth token.' });
  }
  const token = authHeader.split(' ')[1];

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid or expired token.' });

  if (user.email === ADMIN_EMAIL) {
    req.user = { id: user.id, isAdmin: true, remaining: 999 };
    return next();
  }

  const { data, error: rpcError } = await supabaseAdmin.rpc('consume_ai_credit', {
    p_user_id: user.id,
    p_rate_limit_per_minute: RATE_LIMIT_PER_MINUTE
  });

  if (rpcError) {
    console.error('❌ consume_ai_credit RPC error:', rpcError);
    return res.status(500).json({ error: 'Could not verify your credit balance. Please try again.' });
  }

  const result = data?.[0];
  if (!result?.success) {
    if (result?.reason === 'rate_limited') {
      return res.status(429).json({ error: `Too many requests — max ${RATE_LIMIT_PER_MINUTE}/minute. Please slow down.` });
    }
    return res.status(402).json({ error: 'No AI credits remaining. Please top up to continue.', code: 'NO_CREDITS' });
  }

  req.user = { id: user.id, isAdmin: false, remaining: result.remaining };
  next();
};

// Puts a reserved credit back after a failed downstream AI call.
// Admins never had a credit reserved (see bypass above), so callers
// should skip this for req.user.isAdmin.
async function refundCredit(userId) {
  if (!userId) return;
  const { error } = await supabaseAdmin.rpc('refund_ai_credit', { p_user_id: userId });
  if (error) console.error('❌ refund_ai_credit RPC error:', error);
}

// Verifies the bearer token belongs to ADMIN_EMAIL. Used for
// moderation endpoints (edufeed approve/pending) that must never be
// reachable by an ordinary user.
const requireAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing auth token.' });
  }
  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid or expired token.' });
  if (user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Admin access required.' });
  req.user = { id: user.id, isAdmin: true };
  next();
};

function totalMessageChars(messages) {
  return messages.reduce((sum, m) => sum + (typeof m.content === 'string' ? m.content.length : 0), 0);
}

/* ══════════════════════════════════════════════════════════════
   POST /api/compare (DeepSeek)
   ══════════════════════════════════════════════════════════════ */
app.post('/api/compare', checkUsage, async (req, res) => {
  const { question } = req.body;

  if (!question || typeof question !== 'string') {
    if (!req.user.isAdmin) await refundCredit(req.user.id);
    return res.status(400).json({ error: 'Missing question.' });
  }
  if (question.length > MAX_INPUT_CHARS) {
    if (!req.user.isAdmin) await refundCredit(req.user.id);
    return res.status(413).json({ error: `Question too long — keep it under ${MAX_INPUT_CHARS} characters.` });
  }

  try {
    if (!DEEPSEEK_API_KEY) return res.status(400).json({ error: 'DeepSeek API key not configured' });

    const response = await axios.post(
      'https://api.deepseek.com/chat/completions',
      {
        model: 'deepseek-v4-flash',
        thinking: { type: 'disabled' },
        messages: [
          { role: 'system', content: 'You are an AI educator. Provide three distinct perspectives on topics.' },
          { role: 'user', content: `Provide three distinct perspectives on this topic:\n\nTOPIC: "${question}"\n\n1. ANALYTICAL PERSPECTIVE:\n   - Data-driven analysis\n   - Logical breakdown\n   - Key statistics or facts\n   - Technical aspects\n\n2. SIMPLIFIED PERSPECTIVE:\n   - Beginner-friendly explanation\n   - Simple analogies or metaphors\n   - Clear, plain language\n   - Practical examples\n\n3. CRITICAL PERSPECTIVE:\n   - Question assumptions\n   - Explore limitations\n   - Discuss biases or ethical concerns\n   - Alternative viewpoints\n\nKeep each perspective concise (100-150 words). Use clear section headings.` }
        ],
        temperature: 0.7,
        max_tokens: MAX_OUTPUT_TOKENS_SHORT
      },
      { headers: { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 30000 }
    );

    res.json({ success: true, data: response.data.choices[0].message.content, remaining: req.user.remaining });
  } catch (error) {
    if (!req.user.isAdmin) await refundCredit(req.user.id);
    res.status(500).json({ error: error.response?.data?.error?.message || error.message });
  }
});

/* ══════════════════════════════════════════════════════════════
   POST /api/ai (DeepSeek)
   ══════════════════════════════════════════════════════════════ */
app.post('/api/ai', checkUsage, async (req, res) => {
  const { action, messages } = req.body;

  try {
    if (!DEEPSEEK_API_KEY) return res.status(400).json({ error: 'DeepSeek API key not configured' });

    let response;
    switch (action) {
      case 'chat': {
        if (!Array.isArray(messages) || messages.length === 0) {
          if (!req.user.isAdmin) await refundCredit(req.user.id);
          return res.status(400).json({ error: 'No messages provided.' });
        }
        if (totalMessageChars(messages) > MAX_INPUT_CHARS) {
          if (!req.user.isAdmin) await refundCredit(req.user.id);
          return res.status(413).json({ error: `Conversation too long — keep total content under ${MAX_INPUT_CHARS} characters.` });
        }

        response = await axios.post(
          'https://api.deepseek.com/chat/completions',
          { model: 'deepseek-v4-flash', thinking: { type: 'disabled' }, messages, temperature: 0.7, max_tokens: MAX_OUTPUT_TOKENS },
          { headers: { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 60000 }
        );
        break;
      }

      default:
        if (!req.user.isAdmin) await refundCredit(req.user.id);
        return res.status(400).json({ error: 'Invalid action specified.' });
    }

    res.json({ ...response.data, remaining: req.user.remaining });
  } catch (error) {
    console.error('❌ /api/ai error:', error.response?.data || error.message);
    if (!req.user.isAdmin) await refundCredit(req.user.id);
    res.status(500).json({ error: error.response?.data?.error?.message || error.message });
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /api/transcript — Fetch YouTube transcript
   ══════════════════════════════════════════════════════════════ */
const isValidYouTubeId = (id) => /^[a-zA-Z0-9-_]{11}$/.test(id);

app.get('/api/transcript', async (req, res) => {
  const { videoId } = req.query;

  if (!videoId) return res.status(400).json({ error: 'Missing videoId parameter.' });
  if (!isValidYouTubeId(videoId)) return res.status(400).json({ error: 'Invalid YouTube video ID format.' });

  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);

    if (!transcript || transcript.length === 0) {
      return res.status(404).json({ error: 'No transcript found for this video.' });
    }

    const text = transcript.map(t => t.text).join(' ').replace(/\s+/g, ' ').trim();

    const MAX_CHARS = 150000;
    const wasTruncated = text.length > MAX_CHARS;
    const finalText = wasTruncated ? text.slice(0, MAX_CHARS) + '...' : text;

    const wordCount = finalText.match(/\S+/g)?.length || 0;

    return res.status(200).json({
      transcript: finalText,
      wordCount,
      wasTruncated
    });

  } catch (err) {
    console.error(`Transcript error for ${videoId}:`, err.message || err);
    const msg = err.message?.toLowerCase() || '';

    if (msg.includes('disabled') || msg.includes('not available') || msg.includes('no transcript') || msg.includes('could not find')) {
      return res.status(404).json({ error: 'Transcripts are disabled or unavailable for this video.' });
    }

    return res.status(500).json({ error: 'Failed to fetch transcript. YouTube might have blocked the request or the video is private.' });
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /api/youtube — Fetch recent videos
   ══════════════════════════════════════════════════════════════ */
const YOUTUBE_CHANNEL_IDS = ['UCFuDhy4tFjvWnRwvATM7H8Q'];

let youtubeFeedCache = { data: null, timestamp: 0 };
const YOUTUBE_CACHE_DURATION_MS = 15 * 60 * 1000;

async function getUploadsPlaylistId(channelId, apiKey) {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${apiKey}`;
  const { data } = await axios.get(url);
  const uploadsId = data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsId) throw new Error(`No uploads playlist found for channel ${channelId}`);
  return uploadsId;
}

async function getPlaylistVideos(playlistId, apiKey, maxResults = 12) {
  const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=${maxResults}&key=${apiKey}`;
  const { data } = await axios.get(url);

  return (data.items || [])
    .filter(item => item.snippet?.resourceId?.videoId)
    .map(item => ({
      id: item.snippet.resourceId.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
      publishedAt: item.snippet.publishedAt,
      channelTitle: item.snippet.channelTitle,
      platform: 'youtube',
      embedUrl: `https://www.youtube-nocookie.com/embed/${item.snippet.resourceId.videoId}`,
      watchUrl: `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}`,
    }));
}

app.get('/api/youtube', async (req, res) => {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'YouTube API key not configured on server' });
  }

  const queryChannelId = req.query.channelId;
  const forceRefresh = req.query.refresh === '1';
  const channelIds = queryChannelId ? [queryChannelId] : YOUTUBE_CHANNEL_IDS;

  if (!channelIds.length) {
    return res.status(400).json({ error: 'No channel ID configured.' });
  }

  const now = Date.now();
  if (!forceRefresh && youtubeFeedCache.data && now - youtubeFeedCache.timestamp < YOUTUBE_CACHE_DURATION_MS) {
    return res.status(200).json({ videos: youtubeFeedCache.data, cached: true });
  }

  try {
    const allVideos = [];
    for (const channelId of channelIds) {
      const uploadsPlaylistId = await getUploadsPlaylistId(channelId, apiKey);
      const videos = await getPlaylistVideos(uploadsPlaylistId, apiKey);
      allVideos.push(...videos);
    }

    allVideos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    youtubeFeedCache = { data: allVideos, timestamp: now };

    return res.status(200).json({ videos: allVideos, cached: false });
  } catch (err) {
    console.error('❌ /api/youtube error:', err.response?.data || err.message);
    if (youtubeFeedCache.data) {
      return res.status(200).json({ videos: youtubeFeedCache.data, cached: true, stale: true });
    }
    return res.status(502).json({ error: err.response?.data?.error?.message || err.message || 'Failed to fetch YouTube feed' });
  }
});

/* ══════════════════════════════════════════════════════════════
   POST /api/vaibey-context — API Endpoint (uses shared function)
   ══════════════════════════════════════════════════════════════
   🔒 FIXED: this used to accept any `userId` in the body with zero
   auth check, so anyone could read anyone else's notes, quiz
   history, and private messages. Now requires a valid token that
   either belongs to the requested userId, or belongs to the admin.
   ══════════════════════════════════════════════════════════════ */
app.post('/api/vaibey-context', async (req, res) => {
  const { userId, contextType = 'full', limit = 50 } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing auth token.' });
  }
  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid or expired token.' });

  if (user.email !== ADMIN_EMAIL && user.id !== userId) {
    return res.status(403).json({ error: 'You can only fetch your own context.' });
  }

  const result = await fetchVaibeyContext(userId, contextType, limit);

  if (result.success) {
    res.json({
      success: true,
      context: result.context,
      message: `Vaibey context fetched for user ${userId}`
    });
  } else {
    res.status(500).json({
      error: 'Failed to fetch Vaibey context',
      details: result.error
    });
  }
});

/* ══════════════════════════════════════════════════════════════
   POST /api/generate-quiz-from-notes — Uses shared function directly
   ══════════════════════════════════════════════════════════════
   🔒 FIXED: this endpoint had no auth and no rate limit at all —
   anyone could POST arbitrary text and spend DeepSeek calls on your
   key for free. It now sits behind checkUsage like every other AI
   route, and userId comes from the verified token, not the body.
   ══════════════════════════════════════════════════════════════ */
app.post('/api/generate-quiz-from-notes', checkUsage, async (req, res) => {
  const { notes, subject, difficulty = 'medium', count = 10 } = req.body;
  const userId = req.user.id;

  if (!notes || notes.length === 0) {
    if (!req.user.isAdmin) await refundCredit(userId);
    return res.status(400).json({ error: 'No notes provided to generate questions from.' });
  }

  const combinedContent = notes.map(n => n.content).join('\n\n');

  if (combinedContent.length > MAX_INPUT_CHARS) {
    if (!req.user.isAdmin) await refundCredit(userId);
    return res.status(413).json({ error: `Notes too long — keep combined content under ${MAX_INPUT_CHARS} characters, or generate in smaller batches.` });
  }

  // Sane ceiling on requested question count regardless of what the client sends.
  const safeCount = Math.min(Math.max(parseInt(count, 10) || 10, 1), 25);

  let vaibeyContext = { weakAreas: [], studyTopics: [], accuracyRate: 0 };
  try {
    const contextResult = await fetchVaibeyContext(userId, 'quiz');
    if (contextResult.success) {
      const ctx = contextResult.context;
      vaibeyContext = {
        weakAreas: ctx.weakAreas || [],
        studyTopics: ctx.studyTopics || [],
        accuracyRate: ctx.summary?.accuracyRate || 0
      };
      console.log(`📊 Vaibey context loaded: ${vaibeyContext.weakAreas.length} weak areas, ${vaibeyContext.studyTopics.length} topics`);
    }
  } catch (err) {
    console.error('❌ Failed to fetch Vaibey context:', err.message);
  }

  let contextPrompt = '';
  if (vaibeyContext.studyTopics.length > 0) {
    contextPrompt += `\nThe user has been studying these topics: ${vaibeyContext.studyTopics.slice(0, 10).join(', ')}.`;
  }
  if (vaibeyContext.weakAreas.length > 0) {
    contextPrompt += `\nThey have struggled with: ${vaibeyContext.weakAreas.slice(0, 5).join(', ')}. Focus questions on these areas.`;
  }
  if (vaibeyContext.accuracyRate > 0) {
    contextPrompt += `\nTheir overall quiz accuracy is ${vaibeyContext.accuracyRate}%. Adjust difficulty accordingly.`;
  }

  try {
    const response = await axios.post(
      'https://api.deepseek.com/chat/completions',
      {
        model: 'deepseek-v4-flash',
        thinking: { type: 'disabled' },
        messages: [
          {
            role: 'system',
            content: `You are Vaibey, an AI that generates quiz questions from student notes. 
            
${contextPrompt || 'No previous learning data available.'}

Your task: Generate ${safeCount} ${difficulty} difficulty multiple-choice questions based on the provided notes.

Rules:
1. Questions MUST be directly based on the content provided
2. Each question must have 4 options (A, B, C, D)
3. Clearly indicate the correct answer
4. Provide a brief explanation for why the answer is correct
5. Cover the most important concepts from the notes
6. Use ${difficulty} difficulty level: 
   - easy: basic recall, definitions
   - medium: application, understanding
   - hard: analysis, synthesis
7. If the user has weak areas, generate more questions on those topics

Return ONLY a JSON array with this exact structure:
[
  {
    "question": "...",
    "options": ["A", "B", "C", "D"],
    "correct_answer": "...",
    "correct_index": 0,
    "explanation": "..."
  }
]

Do not include any additional text, only the JSON array.`
          },
          {
            role: 'user',
            content: `Subject: ${subject}\n\nNotes to generate questions from:\n\n${combinedContent}`
          }
        ],
        temperature: 0.7,
        max_tokens: MAX_OUTPUT_TOKENS_QUIZ
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );

    let questions = response.data.choices[0].message.content;

    try {
      questions = JSON.parse(questions);
    } catch (e) {
      const jsonMatch = questions.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        questions = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse AI response');
      }
    }

    if (!Array.isArray(questions)) {
      throw new Error('Invalid response format');
    }

    res.json({
      success: true,
      questions,
      context: vaibeyContext,
      remaining: req.user.remaining
    });

  } catch (error) {
    console.error('❌ Quiz generation error:', error);
    if (!req.user.isAdmin) await refundCredit(userId);
    res.status(500).json({
      error: 'Failed to generate questions from notes',
      details: error.message
    });
  }
});

/* ══════════════════════════════════════════════════════════════
   EduFeed endpoints
   ══════════════════════════════════════════════════════════════ */
app.get('/api/edufeed', async (req, res) => {
  const { mood } = req.query;

  try {
    let query = supabaseAdmin
      .from('user_creatives')
      .select('*')
      .eq('edufeed_status', 'approved')
      .order('created_at', { ascending: false });

    if (mood && mood !== 'all') {
      query = query.eq('mood', mood);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Supabase error:', error);
      return res.status(500).json({ error: 'Failed to fetch EduFeed posts' });
    }

    return res.status(200).json({ posts: data || [] });
  } catch (err) {
    console.error('❌ /api/edufeed error:', err);
    return res.status(500).json({ error: 'Failed to fetch EduFeed posts' });
  }
});

// 🔒 FIXED: user_id used to come straight from the request body, so
// anyone could submit a post attributed to someone else's account.
// It's now taken from the verified auth token.
app.post('/api/edufeed', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing auth token.' });
  }
  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid or expired token.' });

  const { title, content, attachments, media_type, mood } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'Missing required fields: title, content' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('user_creatives')
      .insert({
        title,
        content,
        attachments: attachments || [],
        media_type: media_type || 'note',
        mood: mood || 'study',
        user_id: user.id,
        edufeed_status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Supabase insert error:', error);
      return res.status(500).json({ error: 'Failed to submit to EduFeed' });
    }

    return res.status(201).json({
      post: data,
      message: 'Submitted for approval. Your post will appear once reviewed.'
    });
  } catch (err) {
    console.error('❌ /api/edufeed POST error:', err);
    return res.status(500).json({ error: 'Failed to submit to EduFeed' });
  }
});

// 🔒 FIXED: previously had zero auth — anyone could approve or
// reject anyone's post. Now requires the admin token.
app.post('/api/edufeed/approve', requireAdmin, async (req, res) => {
  const { postId, action } = req.body;

  if (!postId || !action) {
    return res.status(400).json({ error: 'Missing postId or action' });
  }

  try {
    const status = action === 'approve' ? 'approved' : 'rejected';
    const { error } = await supabaseAdmin
      .from('user_creatives')
      .update({
        edufeed_status: status,
        approved_at: action === 'approve' ? new Date().toISOString() : null
      })
      .eq('id', postId);

    if (error) {
      console.error('❌ Approval error:', error);
      return res.status(500).json({ error: 'Failed to update post status' });
    }

    return res.status(200).json({
      success: true,
      message: `Post ${action}d successfully`
    });
  } catch (err) {
    console.error('❌ /api/edufeed/approve error:', err);
    return res.status(500).json({ error: 'Failed to process approval' });
  }
});

// 🔒 FIXED: previously had zero auth — the unapproved-post queue
// (unreviewed, possibly rejected content) was publicly readable.
app.get('/api/edufeed/pending', requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_creatives')
      .select('*')
      .eq('edufeed_status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Pending query error:', error);
      return res.status(500).json({ error: 'Failed to fetch pending posts' });
    }

    return res.status(200).json({ posts: data || [] });
  } catch (err) {
    console.error('❌ /api/edufeed/pending error:', err);
    return res.status(500).json({ error: 'Failed to fetch pending posts' });
  }
});

/* ══════════════════════════════════════════════════════════════
   Health check
   ══════════════════════════════════════════════════════════════ */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    deepseekConfigured: !!DEEPSEEK_API_KEY,
    supabaseConfigured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  });
});

app.listen(PORT, () => console.log(`✅ Backend running on http://localhost:${PORT}`));