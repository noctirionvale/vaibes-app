// pages/api/community-room-ai.js
// Single source of truth for the Quiz Arena AI assistant.
// Delete the /api/community-room-ai route from server.js — on Vercel that
// Express route never runs; this file is what actually gets called.

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function buildPrompt({ action, question, message, playerName, difficulty, subject, isCorrect }) {
  if (action === 'new_question') {
    return `A new question has appeared in the quiz room:
Subject: ${subject || 'General'}
Difficulty: ${difficulty || 'medium'}
Question: "${question}"

Introduce the question with enthusiasm in under 2 sentences. If it's hard, offer encouragement; if easy, give a quick tip. Be friendly and engaging.`;
  }

  if (action === 'answer_check') {
    return `A player just answered a question:
Player: "${playerName || 'Someone'}"
Question: "${question}"
Their answer: "${message}"
Correct? ${isCorrect ? 'YES' : 'NO'}

${isCorrect
  ? 'Praise them in 1-2 sentences and optionally add a short fun fact about the topic.'
  : 'Give an encouraging hint in 1-2 sentences without revealing the answer.'}`;
  }

  if (action === 'hint_request') {
    return `Player "${playerName || 'Someone'}" wants a hint for:
Question: "${question}"
Difficulty: ${difficulty || 'medium'}

Give a helpful hint that guides them toward the answer WITHOUT revealing it. Under 2 sentences, use an analogy if useful.`;
  }

  // default: general chat
  return `Player "${playerName || 'Someone'}" said: "${message}"
Current question (if any): "${question || 'none'}"

Respond naturally in 1-2 sentences. If related to the question, offer light guidance; if off-topic, gently steer back to the quiz.`;
}

function fallbackReply(action, isCorrect) {
  const fallbacks = {
    new_question: "Here's the next question! Think carefully and good luck! 💪",
    answer_check: isCorrect ? "That's correct! Well done! 🎉" : "Not quite, but you're on the right track! 💡",
    hint_request: "Think about the main concept we've been discussing — what would apply here? 🤔",
    default: "Good thought — let's keep the quiz moving! ⚡"
  };
  return fallbacks[action] || fallbacks.default;
}

// ── Answer grading — separate from buildPrompt/fallbackReply above because the
//    contract is different: this returns a boolean verdict for the frontend to
//    score against, not a chat message to post. Called only when the fast
//    local heuristic in CommunityRoomPlay.jsx already said "wrong", so it's
//    specifically catching paraphrases/synonyms, not doing all the grading.
//    Low temperature + tight token budget since we just need one JSON boolean,
//    not a creative reply. ───────────────────────────────────────────────────
async function judgeAnswerWithAI({ question, correctAnswer, acceptedAnswers, userAnswer, subject }) {
  const acceptedList = [correctAnswer, ...(acceptedAnswers || [])].filter(Boolean).join(', ');
  const prompt = `You are grading a trivia answer. Be lenient about phrasing, spelling, and partial names — accept synonyms, paraphrases, and answers that clearly mean the same thing, said differently. Be strict about answers that are actually wrong or about a different topic.

Subject: ${subject || 'General'}
Question: "${question}"
Accepted answer(s): ${acceptedList || '(none listed)'}
Player's answer: "${userAnswer}"

Respond with ONLY this JSON, no other text: {"isCorrect": true} or {"isCorrect": false}`;

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
        model: 'deepseek-v4-flash',
        thinking: { type: 'disabled' },
        messages: [
        { role: 'system', content: 'You are a precise quiz grader. You only ever respond with the exact JSON object requested — no explanation, no markdown, no code fences.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 20
    })
  });

  if (!response.ok) throw new Error(`DeepSeek returned ${response.status}`);
  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content?.trim() || '';
  const cleaned = raw.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(cleaned);
  return parsed?.isCorrect === true;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    roomId, question, message, userId, playerName,
    action, difficulty, subject, isCorrect,
    correctAnswer, acceptedAnswers, userAnswer
  } = req.body;

  if (!roomId) {
    return res.status(400).json({ error: 'roomId is required' });
  }

  // Verify the caller has a valid Supabase session.
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  if (!token) {
    return res.status(401).json({ error: 'Missing auth token.' });
  }
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired session.' });
  }

  // ── Answer grading branch — returns { isCorrect } and stops. No chat
  //    message gets posted; this runs silently behind the scenes while a
  //    player's answer is being scored. ───────────────────────────────────
  if (action === 'judge_answer') {
    if (!question || !userAnswer) {
      return res.status(400).json({ error: 'question and userAnswer are required for judge_answer.' });
    }

    let verdict = false; // fail closed: an ungraded answer counts as incorrect, never silently awards points
    if (process.env.DEEPSEEK_API_KEY) {
      try {
        verdict = await judgeAnswerWithAI({ question, correctAnswer, acceptedAnswers, userAnswer, subject });
      } catch (err) {
        console.error('❌ community-room-ai judge_answer error:', err.message);
        verdict = false;
      }
    }

    supabaseAdmin.from('community_room_ai_logs').insert({
      room_id: roomId,
      user_id: userId || user.id,
      action: 'judge_answer',
      question_text: question,
      user_message: userAnswer,
      ai_reply: verdict ? 'correct' : 'incorrect'
    }).then(({ error }) => {
      if (error) console.warn('⚠️ AI log insert skipped:', error.message);
    });

    return res.status(200).json({ isCorrect: verdict });
  }

  const prompt = buildPrompt({ action, question, message, playerName, difficulty, subject, isCorrect });
  let reply;
  let usedFallback = false;

  if (!process.env.DEEPSEEK_API_KEY) {
    reply = fallbackReply(action, isCorrect);
    usedFallback = true;
  } else {
    try {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
        model: 'deepseek-v4-flash',
        thinking: { type: 'disabled' },
        messages: [
            { role: 'system', content: 'You are Vaibey, a helpful and encouraging AI quiz moderator. Keep replies short (1-3 sentences).' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 150
        })
      });

      if (!response.ok) throw new Error(`DeepSeek returned ${response.status}`);
      const data = await response.json();
      reply = data.choices?.[0]?.message?.content?.trim();
      if (!reply) throw new Error('Empty AI response');
    } catch (err) {
      console.error('❌ community-room-ai DeepSeek error:', err.message);
      reply = fallbackReply(action, isCorrect);
      usedFallback = true;
    }
  }

  // Insert the reply directly so every client in the room sees it via realtime —
  // the frontend no longer needs to (and shouldn't) insert this itself.
  const { error: insertError } = await supabaseAdmin.from('community_room_chat').insert({
    room_id: roomId,
    user_id: null,
    message: reply,
    message_type: action === 'hint_request' ? 'ai_hint' : 'ai_response'
  });
  if (insertError) {
    console.error('❌ Failed to insert AI chat message:', insertError.message);
  }

  // Best-effort logging, never blocks the response.
  supabaseAdmin.from('community_room_ai_logs').insert({
    room_id: roomId,
    user_id: userId || user.id,
    action: action || 'chat',
    question_text: question || null,
    user_message: message || null,
    ai_reply: reply
  }).then(({ error }) => {
    if (error) console.warn('⚠️ AI log insert skipped:', error.message);
  });

  return res.status(200).json({ success: true, reply, fallback: usedFallback });
}