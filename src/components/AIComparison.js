import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import AuthModal from './AuthModal';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';

const AIComparison = () => {
  const [inputText, setInputText] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [currentMode, setCurrentMode] = useState('explain');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [requestsRemaining, setRequestsRemaining] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const [persistedVideoId, setPersistedVideoId] = useState(null);
  const [isTranscriptPasted, setIsTranscriptPasted] = useState(false);
  const [summarizeDone, setSummarizeDone] = useState(false); // ✅ Added state
  const dropdownRef = useRef(null);
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const extractYouTubeID = useCallback((url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2]?.length === 11) ? match[2] : null;
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const detected = extractYouTubeID(inputText);
    if (detected) {
      setPersistedVideoId(detected);
    }
  }, [inputText, extractYouTubeID]);

  const activeVideoId = extractYouTubeID(inputText) || persistedVideoId;

  const vAIbesCore = `You are vAIbes, an AI guide on a mission to demystify artificial intelligence through action, not hype.

Who you are:
- Warm and approachable — you talk like a trusted friend, never a textbook
- Flexible — you adjust your depth and tone based on who you're talking to
- Caring — you genuinely want the person to walk away understanding, not just with an answer
- Resilient — if your first explanation doesn't land, you find another angle without being asked
- Honest and humble — you admit what you don't know, you never fake confidence
- You never refer to yourself as DeepSeek, ChatGPT, or any other AI
- When asked who you are or what AI you use: you are vAIbes, and that's all that matters to the user

Your mission: Make AI make sense to real people.`;

  const systemPrompts = {
    explain: `${vAIbesCore}

Your current task: EXPLAIN
- Break down the concept clearly and simply
- Use real-world analogies when helpful
- Check your explanation makes sense end-to-end
- End with one sentence that ties it all together`,

    summarize: `${vAIbesCore}

Your current task: SUMMARIZE
- Extract only the most important points
- Cut ruthlessly — if it's not essential, drop it
- Structure it so someone who hasn't read the original immediately gets it
- Keep it tight and scannable`,

    describe: `${vAIbesCore}

Your current task: DESCRIBE
- Paint a vivid, structured picture with words
- Be specific and observational
- Organize your description logically (big picture first, then details)
- Make the reader feel like they can see it`,

    analyze: `${vAIbesCore}

Your current task: ANALYZE
- Look for patterns, contradictions, and hidden insights
- Don't just describe — interpret what it means
- Point out what's strong, what's weak, what's missing
- Be direct about your findings, even if uncomfortable`,

    generateDesc: `${vAIbesCore}

Your current task: GENERATE DESCRIPTION
- Write compelling, professional copy
- Lead with the strongest benefit or hook
- Be specific — vague descriptions don't sell
- Make it feel human, not like a robot wrote it`,

    generateAudio: `${vAIbesCore}

Your current task: GENERATE AUDIO SCRIPT
- Write naturally spoken words only
- No markdown, no bullet points, no headers
- Use rhythm and flow — this will be read aloud
- Sound like a real person having a conversation, not presenting a report`
  };

  const modeLabels = {
    explain: "Explain Concept",
    summarize: "Summarize Text/Video",
    describe: "Describe Concept",
    analyze: "Analyze Data",
    generateDesc: "Generate Description",
    generateAudio: "Generate Audio (TTS)"
  };

  const handleAudioPlayback = (textToSpeak) => {
    if (!window.speechSynthesis) {
      console.warn('Speech synthesis not supported');
      return;
    }
    setIsSpeaking(true);
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const DAILY_LIMIT = 10;

  const checkAndIncrementUsage = async () => {
    if (!user?.id) {
      return { allowed: false, remaining: 0 };
    }

    const today = new Date().toISOString().split('T')[0];

    try {
      const {  usage, error } = await supabase
        .from('user_usage')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!usage) {
        await supabase.from('user_usage').insert({
          user_id: user.id,
          request_count: 1,
          last_reset: today
        });
        return { allowed: true, remaining: DAILY_LIMIT - 1 };
      }

      if (usage.last_reset !== today) {
        await supabase.from('user_usage').update({
          request_count: 1,
          last_reset: today
        }).eq('user_id', user.id);
        return { allowed: true, remaining: DAILY_LIMIT - 1 };
      }

      if (usage.request_count >= DAILY_LIMIT) {
        return { allowed: false, remaining: 0 };
      }

      await supabase.from('user_usage').update({
        request_count: usage.request_count + 1
      }).eq('user_id', user.id);

      return {
        allowed: true,
        remaining: DAILY_LIMIT - (usage.request_count + 1)
      };
    } catch (err) {
      console.error('Usage check error:', err);
      return { allowed: true, remaining: DAILY_LIMIT };
    }
  };

  const handleSend = async (overrideText = null) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    const { allowed, remaining } = await checkAndIncrementUsage();
    if (!allowed) {
      setResponse(`⚠️ You've used all ${DAILY_LIMIT} of your free daily requests. Come back tomorrow or upgrade to Pro for unlimited access!`);
      return;
    }
    setRequestsRemaining(remaining);

    const textToSend = typeof overrideText === 'string' ? overrideText : inputText;
    if (!textToSend.trim()) return;

    setIsLoading(true);
    setResponse('');
    setIsDropdownOpen(false);
    
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);

    try {
      let secretToken = '';
      try {
        secretToken = localStorage.getItem('admin_bypass_key') || '';
      } catch (e) {
        console.warn('localStorage not accessible');
      }

      const apiResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-bypass': secretToken
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompts[currentMode] },
            { role: 'user', content: textToSend }
          ]
        })
      });

      const data = await apiResponse.json();

      if (apiResponse.status === 429) {
        setResponse(`⚠️ ${data.error}`);
        setIsLoading(false);
        return;
      }

      // ✅ CHANGE 1: Added summarizeDone logic + audio playback
      if (data.choices && data.choices.length > 0) {
        const replyText = data.choices[0].message.content;
        setResponse(replyText);
        
        // Collapse everything after summarize
        if (currentMode === 'summarize') {
          setSummarizeDone(true);
          setIsTranscriptPasted(false);
          setShowVideoPreview(false);
        }
        
        if (currentMode === 'generateAudio') {
          handleAudioPlayback(replyText);
        }
      } else {
        setResponse("Error: Received an unexpected response.");
      }
    } catch (error) {
      console.error("API Error:", error);
      setResponse("Failed to connect to the AI. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Ah! Your browser doesn't support voice input yet. Try using Chrome or Edge!");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      let finalTranscript = transcript;
      let shouldAutoSend = false;

      const triggerMatch = transcript.match(/\b(send it|send)\.?$/i);
      if (triggerMatch) {
        shouldAutoSend = true;
        finalTranscript = transcript.replace(/\b(send it|send)\.?$/i, '').trim();
      }

      setInputText((prevText) => {
        const combinedText = prevText ? prevText + ' ' + finalTranscript : finalTranscript;
        if (shouldAutoSend) {
          setTimeout(() => handleSend(combinedText), 100);
        }
        return combinedText;
      });
    };

    recognition.onerror = (event) => {
      console.error("Microphone error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);
    
    try {
      recognition.start();
    } catch (err) {
      console.error('Failed to start recognition:', err);
      setIsListening(false);
    }
  };

  const handleTextareaChange = (e) => {
    const value = e.target.value;
    setInputText(value);
    
    // ✅ CHANGE 2: Reset summarizeDone when user types
    setSummarizeDone(false);
    
    // Auto-resize textarea
    e.target.style.height = 'auto';
    e.target.style.height = (e.target.scrollHeight) + 'px';
    
    // Detect if transcript was pasted (long text without YouTube link)
    if (currentMode === 'summarize' && value.length > 500 && !extractYouTubeID(value)) {
      setIsTranscriptPasted(true);
    } else {
      setIsTranscriptPasted(false);
    }
  };

  let inputPlaceholder = `Enter text or data to ${currentMode}...`;
  if (currentMode === 'summarize' && activeVideoId) {
    inputPlaceholder = "Video ready! Clear this box, paste the transcript here, then hit Send...";
  } else if (currentMode === 'summarize') {
    inputPlaceholder = "Paste an article, text, or a YouTube link here...";
  }

  return (
    <div className="ai-utility-section">

      {/* 🔆 LAMP TOGGLE */}
      <div className="theme-toggle-wrapper">
        <button className="theme-toggle-btn" onClick={toggleTheme}>
          {isDark ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
              Light Mode
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
              Dark Mode
            </>
          )}
        </button>
      </div>

      <div className="chat-input-container sticky-chatbox" style={{ flexDirection: 'column', alignItems: 'stretch' }}>

        {/* Requests remaining counter */}
        {user && requestsRemaining !== null && (
          <div style={{
            textAlign: 'right',
            fontSize: '0.75rem',
            color: requestsRemaining <= 3
              ? '#ff6b6b'
              : isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.4)',
            paddingRight: '0.5rem',
            marginTop: '0.25rem'
          }}>
            {requestsRemaining} / {DAILY_LIMIT} requests remaining today
          </div>
        )}

        {/* ✅ CHANGE 3: Hide YouTube preview when summarizeDone is true */}
        {activeVideoId && currentMode === 'summarize' && !summarizeDone && (
          <div className="youtube-preview-section">

            {/* Row 1: Thumbnail + Title + Button */}
            <div className="youtube-thumb-row">
              {/* ✅ Also fixed: removed extra spaces in URLs */}
              <img
                src={`https://img.youtube.com/vi/${activeVideoId}/mqdefault.jpg`}
                alt="Video thumbnail"
                className="youtube-thumb"
                onClick={() => setShowVideoPreview(!showVideoPreview)}
              />
              <div 
                className="youtube-thumb-info"
                onClick={() => setShowVideoPreview(!showVideoPreview)}
              >
                <span className="youtube-thumb-label">YouTube Video Detected</span>
                <span className="youtube-thumb-hint">
                  {showVideoPreview ? '▲ Hide player' : '▼ Click thumbnail to preview'}
                </span>
              </div>
              
              <a
                href={`https://www.youtube.com/watch?v=${activeVideoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="fetch-transcript-btn"
                onClick={(e) => e.stopPropagation()}
              >
                📋 Get Transcript
              </a>
            </div>

            {/* Row 2: Collapsible Player */}
            {showVideoPreview && (
              <div className="youtube-player-wrapper">
                <iframe
                  width="100%"
                  height="220"
                  src={`https://www.youtube-nocookie.com/embed/${activeVideoId}`}
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{ borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', display: 'block' }}
                />
              </div>
            )}

            {/* Row 3: Step instructions */}
            <div className="transcript-instructions">
              <div className="transcript-step">
                <span className="transcript-step-num">1</span>
                <span>Click <strong>Get Transcript</strong> → opens video on YouTube</span>
              </div>
              <div className="transcript-step">
                <span className="transcript-step-num">2</span>
                <span>Below the video → click <strong>(...) More</strong> → <strong>Show Transcript</strong></span>
              </div>
              <div className="transcript-step">
                <span className="transcript-step-num">3</span>
                <span>Select all transcript text → <strong>Ctrl+A</strong> → <strong>Copy</strong></span>
              </div>
              <div className="transcript-step">
                <span className="transcript-step-num">4</span>
                <span>Come back here → <strong>clear this box</strong> → paste transcript → hit Send</span>
              </div>
            </div>

          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', width: '100%' }}>

          {/* DROPDOWN */}
          <div className="mode-selector-wrapper" ref={dropdownRef}>
            <button
              className="plus-icon-btn"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              title="Switch Mode"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>

            {isDropdownOpen && (
              <div className="mode-dropdown-menu">
                {Object.keys(modeLabels).map((modeKey) => (
                  <div
                    key={modeKey}
                    className={`dropdown-item ${currentMode === modeKey ? 'active' : ''}`}
                    onClick={() => {
  setCurrentMode(modeKey);
  setIsDropdownOpen(false);
  // Reset all transcript/video state on mode switch
  setIsTranscriptPasted(false);
  setSummarizeDone(false);
  setPersistedVideoId(null);
  setShowVideoPreview(false);
  setInputText('');
  setResponse('');
}}
                  >
                    {modeLabels[modeKey]}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Conditional rendering for transcript box vs textarea */}
          {isTranscriptPasted && currentMode === 'summarize' ? (
            <div className="transcript-paste-box" style={{
              flex: 1,
              background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
              borderRadius: '12px',
              padding: '0.75rem 1rem',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>📄 Transcript Ready</span>
                <button 
                  className="transcript-clear-btn"
                 onClick={() => {
  setInputText('');
  setIsTranscriptPasted(false);
  setSummarizeDone(false);
  setPersistedVideoId(null);
  setShowVideoPreview(false);
}}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}
                >
                  ✕ Clear
                </button>
              </div>
              <div style={{
                fontSize: '0.875rem',
                color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
                maxHeight: '100px',
                overflow: 'auto',
                lineHeight: 1.4
              }}>
                {inputText}
              </div>
              <div style={{ 
                fontSize: '0.75rem', 
                color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                marginTop: '0.5rem'
              }}>
                {inputText.split(/\s+/).filter(w => w).length.toLocaleString()} words · Hit Send to summarize
              </div>
            </div>
          ) : (
            <textarea
              id="question-input"
              placeholder={isListening ? "Listening... Speak now!" : inputPlaceholder}
              value={inputText}
              onChange={handleTextareaChange}
              rows="1"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              style={{ flex: 1 }}
            />
          )}

          {/* MIC */}
          <button
            className={`mic-btn ${isListening ? 'listening-pulse' : ''}`}
            onClick={startListening}
            disabled={isLoading}
            title="Use Voice Input"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="23"></line>
              <line x1="8" y1="23" x2="16" y2="23"></line>
            </svg>
          </button>

          {/* SEND */}
          <button
            id="submit-btn"
            onClick={handleSend}
            disabled={isLoading || (!inputText.trim() && !isTranscriptPasted)}
            title="Send"
          >
            {isLoading ? (
              <span className="loading-dots">...</span>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            )}
          </button>

        </div>
      </div>

      {/* ✅ CHANGE 4: Added position: relative + zIndex to fix scrolling/layering issue */}
      {response && (
        <div 
          className="ai-response-card" 
          style={{ marginTop: '2rem', position: 'relative', zIndex: 1 }}
        >
          <div className="ai-response-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="current-mode-badge">{modeLabels[currentMode]}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {currentMode === 'generateAudio' && isSpeaking && (
                <span className="audio-playing-indicator">
                  <span className="playing-dot"></span> Playing Audio...
                </span>
              )}
              {/* ✅ CHANGE 5: Added setSummarizeDone(false) + setPersistedVideoId(null) to close button */}
              <button
               onClick={() => {
  setResponse('');
  setSummarizeDone(false);
  setIsTranscriptPasted(false);
  setPersistedVideoId(null);
  setShowVideoPreview(false);
  setInputText('');
  window.speechSynthesis.cancel();
  setIsSpeaking(false);
}}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255,255,255,0.4)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#ff4fd8'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
                title="Close response"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
          <div className="ai-response-text">{response}</div>
        </div>
      )}

      {/* AUTH MODAL */}
      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}

    </div>
  );
};

export default AIComparison;