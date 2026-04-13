import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import AuthModal from './AuthModal';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';

const MOBILE_BREAKPOINT = 768;

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
  const [summarizeDone, setSummarizeDone] = useState(false);
  
  // States for Audio and Copy logic
  const [copied, setCopied] = useState(false);
  const [pendingAudioUrl, setPendingAudioUrl] = useState(null);
  const [pendingAudioText, setPendingAudioText] = useState(null);

  // Image Analysis states
  const [uploadedImage, setUploadedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef(null);

  // Feedback states
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackType, setFeedbackType] = useState('suggestion');
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackSending, setFeedbackSending] = useState(false);
  
  const dropdownRef = useRef(null);
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [userTier, setUserTier] = useState('free');

  const DAILY_LIMIT_NEW = 5;
  const DAILY_LIMIT_FREE = 2;
  const PRO_DAILY_LIMIT = 100;

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
    if (detected) setPersistedVideoId(detected);
  }, [inputText, extractYouTubeID]);

  useEffect(() => {
    const fetchTier = async () => {
      if (!user?.id) return;
      try {
        const { data } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle();
        if (data?.plan) setUserTier(data.plan);
      } catch (err) {
        console.error('Error fetching plan:', err);
      }
    };
    fetchTier();
  }, [user?.id]);

  const activeVideoId = extractYouTubeID(inputText) || persistedVideoId;

  // SYSTEM PROMPTS (OMITTED FOR BREVITY - KEEP YOURS AS IS)
  const systemPrompts = { /* ... your prompts ... */ };
  const modeLabels = {
    explain: "Explain Concept",
    summarize: "Summarize Text/Video",
    describe: "Describe Concept",
    analyze: "Analyze Data",
    generateDesc: "Generate Description",
    generateAudio: "Generate Audio (TTS)",
    imageAnalysis: "Image Analysis 🔒"
  };

  const handleAudioPlayback = async (textToSpeak) => {
    // We don't set isSpeaking to true here yet because the user hasn't tapped "Play"
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToSpeak, isPro: userTier === 'pro' })
      });

      const data = await response.json();

      if (data.audioContent) {
        const audioBytes = atob(data.audioContent);
        const arrayBuffer = new ArrayBuffer(audioBytes.length);
        const view = new Uint8Array(arrayBuffer);
        for (let i = 0; i < audioBytes.length; i++) {
          view[i] = audioBytes.charCodeAt(i);
        }
        const blob = new Blob([arrayBuffer], { type: 'audio/mp3' });
        const url = URL.createObjectURL(blob);

        // ✅ THE FIX: We just store the URL. 
        // We wait for the user to tap the "Play Audio" button in the UI.
        setPendingAudioUrl(url);
        setPendingAudioText(textToSpeak);
      } else {
        fallbackTTS(textToSpeak);
      }
    } catch (error) {
      console.error('TTS error:', error);
      fallbackTTS(textToSpeak);
    }
  };

  const handleMobileTTSPlay = () => {
    if (!pendingAudioUrl) return;
    setIsSpeaking(true);
    const audio = new Audio(pendingAudioUrl);
    audio.onended = () => {
      setIsSpeaking(false);
      // We keep the URL so they can replay it if they want
    };
    audio.onerror = () => {
      setIsSpeaking(false);
      fallbackTTS(pendingAudioText);
    };
    audio.play();
  };

  const fallbackTTS = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(response);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      const textArea = document.createElement('textarea');
      textArea.value = response;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSend = async (overrideText = null) => {
    if (!user) { setShowAuthModal(true); return; }
    
    // Reset audio states for new request
    setPendingAudioUrl(null);
    setPendingAudioText(null);
    setIsSpeaking(false);

    const textToSend = typeof overrideText === 'string' ? overrideText : inputText;
    if (!textToSend.trim()) return;

    setIsLoading(true);
    setResponse('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apiResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          messages: [{ role: 'system', content: systemPrompts[currentMode] || '' }, { role: 'user', content: textToSend }]
        })
      });

      const data = await apiResponse.json();
      if (data.choices?.[0]) {
        const replyText = data.choices[0].message.content;
        setResponse(replyText);
        if (currentMode === 'generateAudio') await handleAudioPlayback(replyText);
      }
    } catch (error) {
      console.error("API Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // ... (Keep handleImageUpload, handleImageAnalysis, checkAndIncrementUsage, startListening, handleTextareaChange, handleFeedbackSubmit as they were)

  return (
    <div className="ai-utility-section">
      {/* ... (Theme Toggle and Chat Input Section - Keep as is) ... */}

      {/* Response Card */}
      {response && (
        <div className="ai-response-card" style={{ marginTop: '2rem', position: 'relative', zIndex: 1 }}>
          <div className="ai-response-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="current-mode-badge">{modeLabels[currentMode]}</span>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {/* ✅ UPDATED COPY BUTTON */}
              <button
                onClick={handleCopy}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${copied ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.1)'}`,
                  color: copied ? '#10b981' : 'rgba(255,255,255,0.5)',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '20px',
                  fontSize: '0.72rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>

              <button
                onClick={() => {
                  setResponse('');
                  setPendingAudioUrl(null);
                  setIsSpeaking(false);
                }}
                style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '4px' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>

          {/* ✅ BEAUTIFUL AUDIO PLAY BUTTON (The Mobile Fix) */}
          {currentMode === 'generateAudio' && (
            <div style={{ margin: '1rem 0', display: 'flex', justifyContent: 'center' }}>
              {!pendingAudioUrl && isLoading ? (
                <div style={{ fontSize: '0.85rem', color: '#6a5cff', animate: 'pulse 1.5s infinite' }}>
                  Preparing your audio...
                </div>
              ) : pendingAudioUrl ? (
                <button
                  onClick={handleMobileTTSPlay}
                  className={isSpeaking ? 'audio-playing-pulse' : ''}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    background: isSpeaking ? 'rgba(106, 92, 255, 0.2)' : 'linear-gradient(135deg, #6a5cff, #00e5ff)',
                    border: isSpeaking ? '1px solid #6a5cff' : 'none',
                    borderRadius: '50px',
                    color: 'white',
                    padding: '0.6rem 1.4rem',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: isSpeaking ? 'none' : '0 4px 15px rgba(106, 92, 255, 0.4)',
                    transition: 'all 0.3s ease'
                  }}
                >
                  {isSpeaking ? (
                    <>
                      <span className="playing-dot" style={{ background: '#00e5ff' }}></span>
                      Playing...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                      </svg>
                      Play Audio
                    </>
                  )}
                </button>
              ) : null}
            </div>
          )}

          <div className="ai-response-text">{response}</div>
        </div>
      )}

      {/* ... (Feedback and Auth Modals - Keep as is) ... */}
    </div>
  );
};

export default AIComparison;