import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { useVaibey } from '../context/VaibeyContext';
import AuthModal from './AuthModal';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import TypingCat from './TypingCat';
import { saveToWall } from '../lib/saveToWall';
import { renderMarkdown } from '../lib/markdown';
import './AIComparison.css';

const MOBILE_BREAKPOINT = 768;

const LampToggle = ({ isDark, onClick, size = 28 }) => (
  <button onClick={onClick} className={`lamp-toggle-btn ${isDark ? 'lamp-dark' : 'lamp-light'}`} title="Toggle theme" aria-label="Toggle theme" style={{ width: size, height: size }}>
    <span style={{ fontSize: size * 0.52 }} aria-hidden="true">{isDark ? '💡' : '☀️'}</span>
  </button>
);

const AIComparison = ({ onOpenUpgrade, onInjectToCanvas }) => {
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { getContextForVaibey, scanUserData } = useVaibey();

  useEffect(() => {
    if (user?.id) scanUserData();
  }, [user?.id, scanUserData]);

  // ── ALL ORIGINAL STATES RETAINED ──
  const [inputText, setInputText] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentMode, setCurrentMode] = useState('explain');

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackType, setFeedbackType] = useState('suggestion');
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackSending, setFeedbackSending] = useState(false);

  const [audioBlobUrl, setAudioBlobUrl] = useState(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [apiFailed, setApiFailed] = useState(false);

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const [persistedVideoId, setPersistedVideoId] = useState(null);
  const [isTranscriptPasted, setIsTranscriptPasted] = useState(false);
  const [summarizeDone, setSummarizeDone] = useState(false);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptError, setTranscriptError] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState('');
  const [fetchedUrl, setFetchedUrl] = useState('');

  const [pdfFile, setPdfFile] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const pdfInputRef = useRef(null);

  // ── THREAD STATES (replaces conversationHistory) ──
  const [threads, setThreads] = useState([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historySearchResults, setHistorySearchResults] = useState([]);
  const [historySearching, setHistorySearching] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [activeThread, setActiveThread] = useState(null); // {id, mode, title, messages, readOnly}

  const dropdownRef = useRef(null);
  const textareaRef = useRef(null);

  const extractYouTubeID = useCallback((url) => {
    if (!url) return null;
    const m = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
    return (m && m[2]?.length === 11) ? m[2] : null;
  }, []);

  const isUrl = (str) => {
    try { const url = new URL(str); return url.protocol.startsWith('http'); }
    catch { return false; }
  };

  const activeVideoId = extractYouTubeID(inputText) || persistedVideoId;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const detected = extractYouTubeID(inputText);
    if (detected && detected !== persistedVideoId) setPersistedVideoId(detected);
  }, [inputText, extractYouTubeID, persistedVideoId]);

  useEffect(() => { return () => { if (audioBlobUrl) URL.revokeObjectURL(audioBlobUrl); }; }, [audioBlobUrl]);
  useEffect(() => { return () => { if (recognitionRef.current) recognitionRef.current.abort(); }; }, []);

  // ── THREAD MANAGEMENT ──
  const loadThreads = useCallback(async () => {
    if (!user?.id) return;
    const { data, error } = await supabase.from('conversation_threads')
      .select('*').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(50);
    if (!error && data) setThreads(data);
  }, [user?.id]);

  const searchThreads = async () => {
    if (!historySearchQuery.trim() || !user?.id) { setHistorySearchResults([]); return; }
    setHistorySearching(true);
    try {
      const { data, error } = await supabase.from('conversation_threads').select('*')
        .eq('user_id', user.id)
        .textSearch('search_vector', historySearchQuery, { type: 'websearch', config: 'english' })
        .order('updated_at', { ascending: false }).limit(50);
      if (!error && data) setHistorySearchResults(data);
      else {
        const { data: fb } = await supabase.from('conversation_threads').select('*')
          .eq('user_id', user.id).ilike('search_text', `%${historySearchQuery}%`)
          .order('updated_at', { ascending: false }).limit(50);
        setHistorySearchResults(fb || []);
      }
    } catch (err) { console.error(err); setHistorySearchResults([]); }
    finally { setHistorySearching(false); }
  };

  const deleteThread = async (id) => {
    setDeletingId(id);
    try {
      const { error } = await supabase.from('conversation_threads').delete().eq('id', id).eq('user_id', user.id);
      if (!error) {
        setThreads(prev => prev.filter(i => i.id !== id));
        setHistorySearchResults(prev => prev.filter(i => i.id !== id));
        if (activeThread?.id === id) setActiveThread(null);
      }
    } catch (err) { console.error(err); }
    finally { setDeletingId(null); }
  };

  useEffect(() => { if (user?.id) loadThreads(); }, [user?.id, loadThreads]);

  const openThread = (item, readOnly) => {
    setActiveThread({ ...item, readOnly });
    setCurrentMode(item.mode);
    setShowHistoryModal(false);
    setResponse('');
    setInputText('');
    setTimeout(() => document.querySelector('.thread-view')?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const closeThread = () => setActiveThread(null);

  // ✅ UPDATED: Get system prompt WITH Vaibey context (no more "continuing" hack)
  const getSystemPromptWithContext = (mode) => {
    let prompt = systemPrompts[mode];
    const vaibeyContext = getContextForVaibey();
    
    if (vaibeyContext && Object.keys(vaibeyContext).length > 0) {
      prompt += `\n\n🧠 USER CONTEXT (from VaibeyContext):\n`;
      
      if (vaibeyContext.notes?.length > 0) {
        prompt += `\nRecent Notes:\n`;
        vaibeyContext.notes.slice(0, 5).forEach(note => {
          prompt += `- ${note.title} (${note.subject}): ${note.content?.substring(0, 150)}...\n`;
        });
      }
      
      if (vaibeyContext.quizHistory?.length > 0) {
        prompt += `\nQuiz Performance:\n`;
        vaibeyContext.quizHistory.slice(0, 3).forEach(quiz => {
          prompt += `- ${quiz.topic}: ${quiz.score}% (${new Date(quiz.completed_at).toLocaleDateString()})\n`;
        });
      }
      
      if (vaibeyContext.weakAreas?.length > 0) {
        prompt += `\nWeak Areas to Focus On:\n`;
        vaibeyContext.weakAreas.forEach(area => {
          prompt += `- ${area.topic} (avg: ${area.average_score}%)\n`;
        });
      }
      
      prompt += `\nUse this context to provide personalized, relevant responses. Reference their notes and quiz performance when appropriate.`;
    }
    
    return prompt;
  };

  const createThread = async (mode, userMsg, aiMsg) => {
    if (!user?.id) return null;
    const messages = [
      { role: 'user', content: userMsg, ts: new Date().toISOString() },
      { role: 'assistant', content: aiMsg, ts: new Date().toISOString() },
    ];
    const { data, error } = await supabase.from('conversation_threads').insert({
      user_id: user.id, mode, title: userMsg.slice(0, 80), messages,
    }).select().single();
    if (!error && data) { setThreads(prev => [data, ...prev]); return data; }
    return null;
  };

  const appendToThread = async (thread, userMsg, aiMsg) => {
    const messages = [
      ...thread.messages,
      { role: 'user', content: userMsg, ts: new Date().toISOString() },
      { role: 'assistant', content: aiMsg, ts: new Date().toISOString() },
    ];
    await supabase.from('conversation_threads').update({ messages, mode: currentMode }).eq('id', thread.id);
    setThreads(prev => prev.map(t => t.id === thread.id ? { ...t, messages } : t));
    return messages;
  };

  useEffect(() => { if (user?.id) loadThreads(); }, [user?.id, loadThreads]);

  const vAIbesCore = `You are Vaibey, the AI companion of vAIbes — a complete student workspace that combines AI assistance, creative tools, and community learning.

ABOUT YOUR MEMORY:
- You remember our current conversation completely.
- You have access to the user's recent conversation history.
- You can refer back to what was discussed earlier in this session.
- When the user chooses to "Continue" a past conversation, you'll see the previous Q&A and can build on it.
- Long-term memory is coming soon! Users can save important things to their Vibe Wall.

ABOUT VAIBeS:
vAIbes is an all-in-one educational platform designed for students. It combines:
- 🤖 AI Chat with multiple modes (Explain, Summarize, Analyze, Draft & Edit, Quiz Me)
- ✏️ Creative Workspace - Rich text editor with image/video uploads, file attachments
- 📚 EduFeed - Community learning feed with quizzes, subject quizzes, flashcards
- 🏆 Community Rooms - Live game/trivia rooms where students compete
- 💬 Unified Messaging - Direct messages, group chats, and student marketplace
- 📺 VidFeed - Curated YouTube feed from channels users choose
- 🎧 Study Widget - Music player, clock, timer, and focus tools
- 🧱 Vibe Wall - Personal creative gallery to save and share work
- 📊 Study Dashboard - Track learning patterns, strengths, and weak areas

YOUR ROLE:
You are the AI brain of vAIbes. You help students:
1. Understand concepts clearly (Explain mode)
2. Summarize articles, videos, and documents (Summarize mode)
3. Analyze data and texts deeply (Analyze mode)
4. Write and edit drafts (Draft & Edit mode)
5. Generate quizzes from any material (Quiz Me mode)
6. Connect new information to what the student already knows
7. Guide them to the right part of the platform when needed

YOUR PERSONALITY:
- Warm, encouraging, and approachable — like a trusted study partner
- Adjust depth based on the user's level — never condescending
- If something doesn't land, find another angle without being asked
- Admit what you don't know with confidence, not excuses
- Always tie answers back to helping the student learn and grow
- Never refer to yourself as DeepSeek, ChatGPT, Claude, or any other AI
- You are Vaibey — that's all that matters to the user

PLATFORM KNOWLEDGE:
- vAIbes has free and Pro tiers. Pro unlocks all features.
- The app is built for students who want to learn smarter, not harder.
- Users can create, save, and share content across the platform.
- Everything is designed to reduce app fatigue — one tab for all study needs.
- The product philosophy is "Demystify AI Through Action, Not Hype."

When responding to users, be aware of the full vAIbes ecosystem and help them navigate it naturally. If they ask about a feature, guide them to where they can find it. If they mention something they've saved, use that context in your response. You're not just an AI — you're the face of vAIbes.`;

  const systemPrompts = {
    explain: `${vAIbesCore}\n\nTask: EXPLAIN\n- Break down the concept clearly — start with the simplest version, then add depth\n- Use one concrete real-world analogy the student will actually remember\n- Anticipate the follow-up question they haven't asked yet and answer it\n- End with one sentence that locks in the mental model\n- Never use jargon without immediately defining it\n- If relevant, suggest they save this explanation to their Vibe Wall or create a quiz from it in EduFeed`,

    summarize: `${vAIbesCore}\n\nTask: SUMMARIZE\nThe user will paste a transcript, article, or document. Summarize it using this EXACT markdown structure:\n\n## 🎯 Core Idea\nOne sentence capturing the absolute essence.\n\n## 📌 Key Points\n5-7 bullet points covering the most important ideas. Each a complete thought.\n\n## 💡 Insights Worth Remembering\n2-3 deeper takeaways that change how the reader thinks about the topic.\n\n## ⚡ Quick Facts\nNotable statistics, dates, names, or specific claims.\n\n## 🔗 Related Topics\n3-4 topics the reader might want to explore next.\n\nAfter the summary, suggest they could turn this into a quiz in Community Rooms or save it as a note.`,

    analyze: `${vAIbesCore}\n\nTask: ANALYZE\n- Go beyond description — interpret what the data or text actually means\n- Structure: What's happening → Why it matters → What's missing or weak\n- Call out contradictions, assumptions, or gaps directly\n- If given an academic text, identify the thesis, evidence quality, and counterarguments\n- Be direct. Students need honest analysis, not diplomatic summaries\n- Suggest they could discuss this with others in a Community Room`,

    writeDraft: `${vAIbesCore}\n\nTask: DRAFT & EDIT\n- Student gives you a topic, prompt, or rough notes\n- First ask yourself: what TYPE of writing is this?\n- Write a properly structured draft matching that format\n- For academic writing: clear thesis, body with evidence, strong conclusion\n- For creative: prioritize voice and specificity over generic description\n- Leave [EXPAND HERE] markers where the student should add their own evidence\n- Do NOT add "Here's your draft:" — just write it\n- Remind them they can save this to their Vibe Wall`,

    quizMe: `${vAIbesCore}\n\nTask: QUIZ ME\n- Student pastes notes, a chapter summary, or any study material\n- Generate exactly 5 questions that test genuine understanding, not just memorization\n- Mix: 2 multiple choice (label A B C D), 2 short answer, 1 "explain in your own words"\n- Make questions progressively harder\n- After the questions write: "---" then "ANSWER KEY:" with full explanations\n- Focus on concepts the student is most likely to get wrong or confuse\n- Suggest they could host this as a Community Room to challenge friends!`,
  };

  const modeLabels = { explain: 'Explain', summarize: 'Summarize', analyze: 'Analyze', writeDraft: 'Draft & Edit', quizMe: 'Quiz Me' };
  const modeIcons  = { explain: '💡', summarize: '📋', analyze: '🔍', writeDraft: '✍️', quizMe: '🧠' };

  const fetchTranscript = async (videoId) => {
    setTranscriptLoading(true); setTranscriptError('');
    try {
      const res = await fetch(`/api/transcript?videoId=${videoId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch transcript');
      setInputText(data.transcript); setIsTranscriptPasted(true);
    } catch (err) { setTranscriptError(err.message); }
    finally { setTranscriptLoading(false); }
  };

  const fetchUrl = async (url) => {
    setUrlLoading(true); setUrlError('');
    try {
      const res = await fetch('/api/scrape', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch URL');
      setInputText(data.text); setFetchedUrl(url); setIsTranscriptPasted(true);
    } catch (err) { setUrlError(err.message); }
    finally { setUrlLoading(false); }
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.type !== 'application/pdf') { setPdfError('Please select a PDF file.'); return; }
    if (file.size > 10 * 1024 * 1024) { setPdfError('PDF must be under 10MB.'); return; }
    setPdfFile(file); setPdfError(''); e.target.value = '';
  };

  const sendPdfToAI = async () => {
  if (!pdfFile || !user) { if (!user) setShowAuthModal(true); return; }
  setPdfLoading(true); setResponse(''); setPdfError('');
  try {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(pdfFile);
    });
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({
        action: 'analyze-pdf',      // was 'ai' — router only knows 'chat' | 'fetch-content' | 'analyze-pdf'
        pdfBase64: base64,          // was the undefined var `pdfBase64`
        filename: pdfFile.name,     // was the undefined var `filename`
        mode: currentMode,          // was the undefined var `mode`
      }),
    });
    const data = await res.json().catch(() => ({ error: 'Server returned invalid response' }));
    if (!res.ok) throw new Error(data.error || 'PDF analysis failed');
    const text = data.choices?.[0]?.message?.content;
    if (text) setResponse(text); else throw new Error('No response from AI');
  } catch (err) { setPdfError(err.message); }
  finally { setPdfLoading(false); }
};

  const handleAudioPlayback = async (textToSpeak) => {
    if (audioBlobUrl) { URL.revokeObjectURL(audioBlobUrl); setAudioBlobUrl(null); }
    setIsAudioPlaying(false); setApiFailed(false);
    try {
      const res = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: textToSpeak, isPro: true }) });
      if (!res.ok) throw new Error(`TTS error ${res.status}`);
      const data = await res.json();
      if (data.audioContent) {
        const bytes = atob(data.audioContent); const buf = new ArrayBuffer(bytes.length); const view = new Uint8Array(buf);
        for (let i = 0; i < bytes.length; i++) view[i] = bytes.charCodeAt(i);
        setAudioBlobUrl(URL.createObjectURL(new Blob([buf], { type: 'audio/mp3' })));
      } else throw new Error('No audio content');
    } catch (err) { console.error('TTS Failed:', err); setApiFailed(true); }
  };

  const speakFallback = (text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.onstart = () => setIsAudioPlaying(true); u.onend = () => setIsAudioPlaying(false); u.onerror = () => setIsAudioPlaying(false);
    window.speechSynthesis.speak(u);
  };

  const handleManualPlay = () => {
    if (isAudioPlaying) return;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (audioBlobUrl && !apiFailed) {
      const audio = new Audio(audioBlobUrl);
      audio.onplay = () => setIsAudioPlaying(true); audio.onended = () => setIsAudioPlaying(false);
      audio.onerror = () => { setIsAudioPlaying(false); speakFallback(response); };
      audio.play().catch(() => speakFallback(response));
    } else { speakFallback(response); }
  };

  const handleCopy = async (text) => {
  const toCopy = text ?? response;
  try { await navigator.clipboard.writeText(toCopy); }
  catch {
    const ta = document.createElement('textarea'); ta.value = toCopy; ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.focus(); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
  }
  setCopied(true); setTimeout(() => setCopied(false), 2000);
};

  const resetAll = () => {
    setResponse(''); setSummarizeDone(false); setIsTranscriptPasted(false);
    setPersistedVideoId(null); setShowVideoPreview(false); setInputText('');
    setFetchedUrl(''); setTranscriptError(''); setUrlError('');
    setPdfFile(null); setPdfError('');
    if (audioBlobUrl) { URL.revokeObjectURL(audioBlobUrl); setAudioBlobUrl(null); }
    setIsAudioPlaying(false); setApiFailed(false);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setActiveThread(null);
  };

  const handleSend = async (overrideText = null) => {
    if (!user) { setShowAuthModal(true); return; }
    if (activeThread?.readOnly) return;

    const textToSend = typeof overrideText === 'string' ? overrideText : inputText;
    if (!textToSend.trim()) return;

    setIsLoading(true);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (audioBlobUrl) { URL.revokeObjectURL(audioBlobUrl); setAudioBlobUrl(null); }
    setIsAudioPlaying(false); setApiFailed(false);

    const { data: { session } } = await supabase.auth.getSession();
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` };
    const systemPrompt = getSystemPromptWithContext(currentMode);

    try {
      let userContent = textToSend;
      if (currentMode === 'summarize' && !activeThread) {
        const sourceLabel = activeVideoId ? 'YouTube video transcript' : fetchedUrl ? 'web article' : 'text';
        const titleLine = persistedVideoId ? `Source: YouTube video (${persistedVideoId})\n\n` : fetchedUrl ? `Source: ${fetchedUrl}\n\n` : '';
        userContent = `${titleLine}Please summarize the following ${sourceLabel}:\n\n${textToSend}`;
      }

      const priorMessages = activeThread
        ? activeThread.messages.map(m => ({ role: m.role, content: m.content }))
        : [];

      const apiResponse = await fetch('/api/ai', {
  method: 'POST',
  headers,   // the headers const you already built above with session.access_token
  body: JSON.stringify({
    action: 'chat',
    messages: [
      { role: 'system', content: systemPrompt },
      ...priorMessages,
      { role: 'user', content: userContent },
    ],
    thread_id: activeThread?.id,
  }),
});

      if (apiResponse.status === 402) { setResponse('✨ AI chat is a Pro feature. Please upgrade to Pro.'); if (onOpenUpgrade) onOpenUpgrade(); setIsLoading(false); return; }
      if (apiResponse.status === 429) { const d = await apiResponse.json(); setResponse(`⚠️ ${d.error}`); setIsLoading(false); return; }

      const data = await apiResponse.json().catch(() => null);
      if (!apiResponse.ok || !data) throw new Error(data?.error || 'Request failed.');

      const replyText = data.choices?.[0]?.message?.content;
      if (!replyText) { setResponse('Unexpected response from AI.'); setIsLoading(false); return; }

      if (activeThread) {
        const updatedMessages = await appendToThread(activeThread, textToSend, replyText);
        setActiveThread(prev => ({ ...prev, messages: updatedMessages }));
        setInputText('');
      } else {
  setResponse(replyText);
  const newThread = await createThread(currentMode, textToSend, replyText);
  if (newThread) setActiveThread(newThread);

  // Auto-save to the Wall — skipping quizMe since those probably belong in
  // EduFeed, not as a Wall note. Add/remove modes here as you like.
  const AUTO_SAVE_MODES = ['explain', 'summarize', 'analyze', 'writeDraft'];
if (AUTO_SAVE_MODES.includes(currentMode)) {
  try {
    await saveToWall(supabase, user, {
      title: textToSend,
      content: `<p>${renderMarkdown(replyText)}</p>`,
    });
  } catch (e) {
    console.error('[AIComparison] failed to auto-save to Wall', e);
  }
}
        if (currentMode === 'summarize') {
          setSummarizeDone(true); setIsTranscriptPasted(false); setShowVideoPreview(false);
          setInputText(''); setPersistedVideoId(null); setFetchedUrl('');
          if (textareaRef.current) textareaRef.current.style.height = 'auto';
        }
        if (currentMode === 'writeDraft') await handleAudioPlayback(replyText);
      }
    } catch (err) {
      console.error('API Error:', err);
      setResponse(`❌ ${err.message || 'Failed to connect. Please try again.'}`);
    } finally { setIsLoading(false); }
  };

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Your browser doesn't support voice input."); return; }
    if (recognitionRef.current) recognitionRef.current.abort();
    const r = new SR(); recognitionRef.current = r;
    r.continuous = false; r.interimResults = false;
    r.onstart = () => setIsListening(true);
    r.onresult = (e) => {
      const t = e.results[0][0].transcript; let final = t; let autoSend = false;
      const tm = t.match(/\b(send it|send)\.?$/i);
      if (tm) { autoSend = true; final = t.replace(/\b(send it|send)\.?$/i, '').trim(); }
      setInputText(prev => {
        const combined = prev ? prev + ' ' + final : final;
        if (autoSend) setTimeout(() => handleSend(combined), 100);
        return combined;
      });
    };
    r.onerror = () => setIsListening(false); r.onend = () => setIsListening(false);
    try { r.start(); } catch { setIsListening(false); }
  };

  const handleTextareaChange = (e) => {
    const val = e.target.value;
    setInputText(val);
    setSummarizeDone(false);
    setFetchedUrl('');
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;

    if (currentMode === 'summarize' && val.length > 280 && !extractYouTubeID(val) && !isUrl(val)) {
      setIsTranscriptPasted(true);
    } else {
      setIsTranscriptPasted(false);
    }
  };

  const handleFeedbackSubmit = async () => {
    if (!feedbackText.trim()) return; setFeedbackSending(true);
    try {
      await supabase.from('feedback').insert({ user_id: user?.id || null, type: feedbackType, message: feedbackText, created_at: new Date().toISOString() });
      setFeedbackSent(true);
      setTimeout(() => { setShowFeedback(false); setFeedbackSent(false); setFeedbackText(''); setFeedbackType('suggestion'); }, 2500);
    } catch (err) { console.error('Feedback error', err); }
    finally { setFeedbackSending(false); }
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT;
  // add near isMobile, right before the return statement
const showThreadView = !!activeThread && (activeThread.readOnly !== undefined || activeThread.messages.length > 2);

  let inputPlaceholder;
  if (activeThread && !activeThread.readOnly) {
    inputPlaceholder = '💬 Continue this conversation...';
  } else if (activeThread?.readOnly) {
    inputPlaceholder = '👁 Read-only mode — close thread to start new';
  } else if (currentMode === 'summarize') {
    if (activeVideoId) inputPlaceholder = 'YouTube detected — click "Fetch Transcript" to auto-load...';
    else if (isMobile) inputPlaceholder = 'Paste article text, a URL, or YouTube link to summarize...';
    else inputPlaceholder = 'Paste text, a URL, or a YouTube link — ...';
  } else if (currentMode === 'analyze') {
    inputPlaceholder = '🔍 Paste data, text, or upload a PDF below...';
  } else if (currentMode === 'writeDraft') {
    inputPlaceholder = '✍️ Describe what you want to write (topic, tone, length)...';
  } else if (currentMode === 'quizMe') {
    inputPlaceholder = '🧠 Paste your notes or study material — I\'ll generate 5 questions...';
  } else {
    inputPlaceholder = `${modeIcons[currentMode]} ${modeLabels[currentMode]}...`;
  }

  return (
    <div className="ai-utility-section">
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
        <TypingCat mode={currentMode} isDark={isDark} onResponse={!!response && !isLoading} size={4} showBadge={true} showQuip={true} peekBounce={true} />
      </div>

      <div className="vaibey-wrapper" style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}></div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem', paddingRight: '0.25rem', marginBottom: '0.5rem' }}>
        {currentMode === 'analyze' && (
  <div className="pdf-controls-wrapper">
    <input 
      ref={pdfInputRef} 
      type="file" 
      accept="application/pdf" 
      style={{ display: 'none' }} 
      onChange={handlePdfUpload} 
    />
    <button 
      className={`pdf-upload-btn ${pdfFile ? 'has-file' : ''}`} 
      onClick={() => pdfInputRef.current?.click()} 
      disabled={pdfLoading}
      title={pdfFile ? pdfFile.name : 'Upload PDF'}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
      {pdfFile ? pdfFile.name.slice(0, 12) + (pdfFile.name.length > 12 ? '…' : '') : 'Upload PDF'}
    </button>
    
    {pdfFile && (
      <>
        <button 
          className="pdf-analyze-btn" 
          onClick={sendPdfToAI} 
          disabled={pdfLoading}
        >
          {pdfLoading ? (
            <>
              <span className="spinner"></span> Analyzing...
            </>
          ) : (
            '🔍 Analyze PDF'
          )}
        </button>
        <button 
          className="pdf-clear-btn" 
          onClick={() => { 
            setPdfFile(null); 
            setPdfError(''); 
            if (pdfInputRef.current) pdfInputRef.current.value = '';
          }} 
          title="Remove PDF"
        >
          ✕
        </button>
        <span className="pdf-status-text">
          ✓ Loaded <span className="file-size">({(pdfFile.size / 1024).toFixed(1)} KB)</span>
        </span>
      </>
    )}
  </div>
)}

{/* Show error outside the wrapper for better visibility */}
{pdfError && (
  <div className="pdf-error-msg">
    <span className="error-icon">⚠️</span> {pdfError}
  </div>
)}

        <button className="history-icon-btn" onClick={() => { setShowHistoryModal(true); setHistorySearchQuery(''); setHistorySearchResults([]); }} title="Conversation History">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span className="history-badge">{threads.length}</span>
        </button>
      </div>

      <div className="chat-input-container sticky-chatbox">
        <LampToggle isDark={isDark} onClick={toggleTheme} size={28} />

        {activeVideoId && currentMode === 'summarize' && !summarizeDone && !isTranscriptPasted && (
          <div className="youtube-preview-section">
            <div className="youtube-thumb-row">
              <img 
                src={`https://img.youtube.com/vi/${activeVideoId}/mqdefault.jpg`} 
                alt="thumbnail" 
                className="youtube-thumb" 
                onClick={() => setShowVideoPreview(!showVideoPreview)} 
              />
              <div className="youtube-thumb-info">
                <span className="youtube-thumb-label">🎬 YouTube Video Detected</span>
                <span className="youtube-thumb-hint">
                  {showVideoPreview ? '▲ Hide preview' : '▼ Click to preview'}
                </span>
              </div>
              <button 
                className="fetch-transcript-btn" 
                onClick={() => fetchTranscript(activeVideoId)} 
                disabled={transcriptLoading}
              >
                {transcriptLoading ? '⏳ Fetching...' : '📝 Fetch Transcript'}
              </button>
            </div>
            {transcriptError && (
              <div className="transcript-error">
                ⚠️ {transcriptError} — 
                <a href={`https://www.youtube.com/watch?v=${activeVideoId}`} target="_blank" rel="noopener noreferrer">
                  open on YouTube
                </a> to copy manually.
                <button 
                  className="link-clear-btn transcript-error-clear" 
                  onClick={() => {
                    setInputText('');
                    setPersistedVideoId(null);
                    setShowVideoPreview(false);
                    setTranscriptError('');
                    setIsTranscriptPasted(false);
                  }}
                >
                  ✕ Clear
                </button>
              </div>
            )}
            {showVideoPreview && (
              <iframe 
                width="100%" 
                height="200" 
                src={`https://www.youtube-nocookie.com/embed/${activeVideoId}`} 
                title="YouTube video player" 
                frameBorder="0" 
                allowFullScreen 
                className="youtube-iframe" 
              />
            )}
          </div>
        )}

        {currentMode === 'summarize' && isUrl(inputText) && !activeVideoId && !isTranscriptPasted && inputText.trim() && (
          <div className="summarize-link-preview">
            <div className="link-preview-card">
              <div className="link-preview-icon">🔗</div>
              <div className="link-preview-info">
                <div className="link-preview-url">{inputText.length > 60 ? inputText.substring(0, 60) + '...' : inputText}</div>
                <div className="link-preview-label">Webpage Link Detected</div>
              </div>
              <div className="link-preview-actions">
                <button 
                  className="link-fetch-btn" 
                  onClick={() => fetchUrl(inputText)} 
                  disabled={urlLoading}
                >
                  {urlLoading ? '⏳ Fetching...' : '🌐 Fetch Content'}
                </button>
                <button 
                  className="link-clear-btn" 
                  onClick={() => setInputText('')}
                >
                  ✕ Clear
                </button>
              </div>
            </div>
            {urlError && <div className="transcript-error" style={{ marginTop: '0.5rem' }}>⚠️ {urlError}</div>}
          </div>
        )}

        {currentMode === 'summarize' && isTranscriptPasted && !summarizeDone && (
          <div className="summarize-link-preview">
            <div className="link-preview-card" style={{ background: 'rgba(16, 185, 129, 0.08)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
              <div className="link-preview-icon">{fetchedUrl ? '🌐' : '📄'}</div>
              <div className="link-preview-info">
                <div className="link-preview-url">
                  {fetchedUrl ? 'Content fetched from webpage' : activeVideoId ? 'Transcript loaded' : 'Text ready to summarize'}
                </div>
                <div className="transcript-ready-badge" style={{ marginTop: '0.25rem', display: 'inline-flex' }}>
                  <span>✓</span> Ready to summarize
                  <span className="transcript-word-count">
                    ({inputText.split(/\s+/).filter(w => w).length.toLocaleString()} words)
                  </span>
                </div>
              </div>
              <div className="link-preview-actions">
                <button 
                  className="link-clear-btn" 
                  onClick={() => {
                    setInputText('');
                    setIsTranscriptPasted(false);
                    setSummarizeDone(false);
                    setPersistedVideoId(null);
                    setFetchedUrl('');
                    if (textareaRef.current) textareaRef.current.style.height = 'auto';
                  }}
                >
                  ✕ Clear
                </button>
              </div>
            </div>
          </div>
        )}

        <div className={`chat-input-row ${!isMobile && ((activeVideoId && currentMode === 'summarize' && !summarizeDone && !isTranscriptPasted) || (currentMode === 'summarize' && isUrl(inputText) && !activeVideoId && !isTranscriptPasted && inputText.trim())) ? 'chat-input-row-hidden' : ''}`}>
          <div className="mode-selector-wrapper" ref={dropdownRef}>
            <button className="plus-icon-btn" onClick={() => setIsDropdownOpen(d => !d)} title="Switch Mode">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            {isDropdownOpen && (
              <div className="mode-dropdown-menu">
                {Object.entries(modeLabels).map(([key, label]) => (
                  <div key={key} className={`dropdown-item ${currentMode === key ? 'active' : ''}`} onClick={() => { setCurrentMode(key); setIsDropdownOpen(false); }}>
                    {modeIcons[key]} {label}
                  </div>
                ))}
              </div>
            )}
          </div>

          <textarea 
            ref={textareaRef} 
            id="question-input" 
            placeholder={isListening ? 'Listening...' : inputPlaceholder} 
            value={(isTranscriptPasted || (activeVideoId && currentMode === 'summarize' && !summarizeDone)) ? '' : inputText} 
            onChange={handleTextareaChange} 
            rows="1" 
            onKeyDown={(e) => { 
              if (e.key === 'Enter' && !e.shiftKey) { 
                e.preventDefault(); 
                handleSend(); 
              } 
            }} 
          />

          <button id="submit-btn" onClick={() => handleSend()} disabled={isLoading || (!inputText.trim() && !isTranscriptPasted)}>
            {isLoading ? <span className="loading-dots">...</span> : <img src="/hero.ai.png" alt="vAIbes" />}
          </button>

          <button className={`mic-btn ${isListening ? 'listening-pulse' : ''}`} onClick={startListening} disabled={isLoading} aria-label="Voice Input">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
          </button>
        </div>

        {urlError && <div className="transcript-error" style={{ marginTop: '0.5rem' }}>⚠️ {urlError}</div>}
      </div>

      {showThreadView ? (
  <div className="ai-response-card thread-view" style={{ marginTop: '2rem', position: 'relative', zIndex: 1 }}>
    <div className="ai-response-header">
      <div className="response-header-left">
        <span className="current-mode-badge">{modeIcons[activeThread.mode]} {modeLabels[activeThread.mode]}</span>
      </div>
      <div className="response-actions">
        {activeThread.readOnly && <span className="usage-badge">👁 Read only</span>}
        <button
          className={`action-btn action-btn-copy ${copied ? 'copied' : ''}`}
          onClick={() => handleCopy(activeThread.messages[activeThread.messages.length - 1]?.content || '')}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
        <button className="action-btn action-btn-reset" onClick={closeThread} title="Close thread">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>
    <div className="thread-messages">
      {activeThread.messages.map((m, i) => (
        <div key={i} className={`thread-msg thread-msg-${m.role}`}>
          <span className="thread-msg-label">{m.role === 'user' ? 'You' : 'Vaibey'}</span>
          <div className="thread-msg-text">{m.content}</div>
        </div>
      ))}
    </div>
  </div>
) : response && (
  // ...unchanged plain response card...
        <div className="ai-response-card" style={{ marginTop: '2rem', position: 'relative', zIndex: 1 }}>
          <div className="ai-response-header">
            <div className="response-header-left">
              <span className="current-mode-badge">{modeIcons[currentMode]} {modeLabels[currentMode]}</span>
            </div>
            <div className="response-actions">
              <button className={`action-btn action-btn-copy ${copied ? 'copied' : ''}`} onClick={handleCopy}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
              <button className="action-btn action-btn-reset" onClick={resetAll}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>

          {currentMode === 'writeDraft' && (
            <div className="audio-player-wrapper">
              {apiFailed && <div className="tts-fallback-msg">⚠️ TTS error — using browser speech</div>}
              <button onClick={handleManualPlay} className={`audio-play-btn ${isAudioPlaying ? 'playing' : ''}`} disabled={isAudioPlaying}>
                {isAudioPlaying ? <><span className="waveform"><span/><span/><span/><span/></span><span>Playing...</span></> : <><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg><span>Play Audio</span></>}
              </button>
            </div>
          )}

          <div className="ai-response-text">{response}</div>
        </div>
      )}

      {!isLoading && (
        <div className="feedback-btn-wrap">
          <button className="feedback-btn" onClick={() => setShowFeedback(true)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Send Feedback
          </button>
        </div>
      )}

      {showFeedback && createPortal(
        <div className="feedback-modal-overlay" onClick={() => setShowFeedback(false)}>
          <div className="feedback-modal" onClick={e => e.stopPropagation()}>
            {feedbackSent ? (
              <div className="feedback-success"><div className="feedback-success-icon">🎉</div><div>Thanks!</div></div>
            ) : (
              <>
                <div className="feedback-modal-header"><h4>Send Feedback</h4><button className="feedback-close" onClick={() => setShowFeedback(false)}>✕</button></div>
                <div className="feedback-types">
                  {['suggestion','bug','compliment','other'].map(t => (
                    <button key={t} className={`feedback-type-btn ${feedbackType===t?'active':''}`} onClick={() => setFeedbackType(t)}>
                      {t==='suggestion'&&'💡 Suggestion'}{t==='bug'&&'🐛 Bug'}{t==='compliment'&&'❤️ Love it'}{t==='other'&&'💬 Other'}
                    </button>
                  ))}
                </div>
                <textarea className="feedback-textarea" rows={4} value={feedbackText} onChange={e => setFeedbackText(e.target.value)} placeholder={feedbackType==='bug'?'What went wrong?':feedbackType==='suggestion'?'What would help?':feedbackType==='compliment'?'Tell us! 😊':"What's on your mind?"} />
                <button className="feedback-submit" onClick={handleFeedbackSubmit} disabled={!feedbackText.trim()||feedbackSending}>{feedbackSending ? 'Sending...' : 'Send →'}</button>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {showHistoryModal && createPortal(
        <div className="history-modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="history-modal" onClick={e => e.stopPropagation()}>
            <div className="history-modal-header">
              <h3>📚 Conversation History</h3>
              <button className="history-modal-close" onClick={() => setShowHistoryModal(false)}>✕</button>
            </div>
            <div className="history-search-row">
              <input type="text" className="history-search-input" placeholder="Search past questions or answers..." value={historySearchQuery} onChange={(e) => { setHistorySearchQuery(e.target.value); if (e.target.value.length > 2) setTimeout(() => searchThreads(), 300); else if (e.target.value.length === 0) setHistorySearchResults([]); }} onKeyPress={(e) => e.key === 'Enter' && searchThreads()} />
              <button className="history-search-btn" onClick={searchThreads} disabled={historySearching}>{historySearching ? '⏳' : '🔍'}</button>
            </div>
            {(historySearchResults.length > 0 || historySearchQuery) && (
              <div className="history-results-info">
                {historySearchResults.length} result{historySearchResults.length !== 1 ? 's' : ''}{historySearchQuery && ` for "${historySearchQuery}"`}
                <button className="history-clear-search" onClick={() => { setHistorySearchQuery(''); setHistorySearchResults([]); }}>Clear</button>
              </div>
            )}
           <div className="history-list">
  {(historySearchResults.length > 0 ? historySearchResults : threads).length === 0 ? (
    <div className="history-empty"><span>📭</span><p>No conversations yet</p><small>Your AI interactions will appear here</small></div>
  ) : (
    (historySearchResults.length > 0 ? historySearchResults : threads).map(item => (
      <div key={item.id} className="history-item">
        <div className="history-item-header">
          <span className="history-item-mode">{modeIcons[item.mode] || '💬'} {modeLabels[item.mode] || item.mode}</span>
          <span className="history-item-date">{new Date(item.updated_at || item.created_at).toLocaleString()}</span>
        </div>
        <div className="history-item-question"><strong>Q:</strong> {item.title || (item.messages?.[0]?.content?.substring(0, 200) || 'No title')}</div>
        <div className="history-item-answer-preview"><strong>A:</strong> {item.messages?.[item.messages.length - 1]?.content?.substring(0, 100) || '...'}</div>
        <div className="history-item-actions">
          <button 
            className="history-continue-btn" 
            onClick={() => openThread(item, false)}
            title="Continue this thread"
          >
            ↺ Restore
          </button>
          <button 
            className="history-restore-btn" 
            onClick={() => openThread(item, true)}
            title="Read only"
          >
            👁 Read
          </button>
          <button 
            className="history-delete-btn" 
            onClick={() => deleteThread(item.id)} 
            disabled={deletingId === item.id}
          >
            {deletingId === item.id ? '...' : '🗑 Delete'}
          </button>
        </div>
      </div>
    ))
  )}
</div>
          </div>
        </div>,
        document.body
      )}

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </div>
  );
};

export default AIComparison;