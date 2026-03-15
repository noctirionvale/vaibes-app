import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import AuthModal from './AuthModal';

const AIComparison = () => {
  const [inputText, setInputText] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false); // Our Mic state
  const [currentMode, setCurrentMode] = useState('explain');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // 🔐 Auth state
  const { user } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper to extract YouTube ID
  const extractYouTubeID = (url) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const videoId = extractYouTubeID(inputText);

  // THE BRAINS
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
    setIsSpeaking(true);
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  // THE SEND LOGIC
  const handleSend = async (overrideText = null) => {
    // 🔒 GATE: Block guests
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    // If the mic passes text directly, use that. Otherwise, use what's in the text box.
    const textToSend = typeof overrideText === 'string' ? overrideText : inputText; 
    
    if (!textToSend.trim()) return;
    
    setIsLoading(true);
    setResponse('');
    setIsDropdownOpen(false);
    window.speechSynthesis.cancel(); 
    setIsSpeaking(false);

    try {
      const secretToken = localStorage.getItem('admin_bypass_key') || '';

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

      if (data.choices && data.choices.length > 0) {
        const replyText = data.choices[0].message.content;
        setResponse(replyText);
        
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

  // THE SMART MIC LOGIC
  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert("Ah! Your browser doesn't support voice input yet. Try using Chrome or Edge!");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      let finalTranscript = transcript;
      let shouldAutoSend = false;

      // Check if they said "send it"
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

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  // Dynamic Placeholder Logic
  let inputPlaceholder = `Enter text or data to ${currentMode}...`;
  if (currentMode === 'summarize' && videoId) {
    inputPlaceholder = "Video detected! Paste the video transcript here so I can summarize it...";
  } else if (currentMode === 'summarize') {
    inputPlaceholder = "Paste an article, text, or a YouTube link here...";
  }

  return (
    <div className="ai-utility-section">
      
      {/* 1. CHAT INPUT AT THE TOP & MADE STICKY */}
      <div className="chat-input-container sticky-chatbox" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        
        {/* The Video Preview Player */}
        {videoId && currentMode === 'summarize' && (
          <div className="video-preview-wrapper" style={{ width: '100%', marginBottom: '1rem', padding: '0.5rem' }}>
            {/* ✨ THE FIX: Using YouTube's no-cookie domain safely outside the tag! */}
            <iframe
              width="100%"
              height="250"
              src={`https://www.youtube-nocookie.com/embed/${videoId}`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}
            ></iframe>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', width: '100%' }}>
          
          {/* THE DROPDOWN MENU */}
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
                    }}
                  >
                    {modeLabels[modeKey]}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* THE TEXTAREA (Fully Restored Logic) */}
          <textarea 
            id="question-input" 
            placeholder={isListening ? "Listening... Speak now!" : inputPlaceholder}
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = (e.target.scrollHeight) + 'px';
            }}
            rows="1"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />

          {/* THE MIC BUTTON */}
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

          {/* THE SUBMIT BUTTON */}
          <button 
            id="submit-btn" 
            onClick={handleSend} 
            disabled={isLoading || !inputText.trim()}
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

      {/* 2. OUTPUT DISPLAY SPILLS OUT BELOW IT */}
      {response && (
        <div className="ai-response-card" style={{ marginTop: '2rem' }}>
          <div className="ai-response-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="current-mode-badge">{modeLabels[currentMode]}</span>
            
            {currentMode === 'generateAudio' && isSpeaking && (
              <span className="audio-playing-indicator">
                <span className="playing-dot"></span> Playing Audio...
              </span>
            )}
          </div>
          <div className="ai-response-text">{response}</div>
        </div>
      )}

      {/* 🔐 Auth Modal for guests */}
      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}
    </div>
  );
};

export default AIComparison;