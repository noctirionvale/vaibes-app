import React, { useState, useEffect, useRef } from 'react';

const AIComparison = () => {
  const [inputText, setInputText] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const [currentMode, setCurrentMode] = useState('explain');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

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

  // THE BRAINS: Updated to match your exact tool requests
  const systemPrompts = {
    explain: "You are a clear, logical teacher. Explain the user's prompt simply and accurately without hype or jargon.",
    summarize: "You are an expert editor. Summarize the provided text or video transcript concisely, highlighting only the most important main points and key takeaways.",
    describe: "You are a highly observant writer. Provide a detailed, vivid, and structured description based on the prompt or scenario provided.",
    analyze: "You are an expert data analyst and logical thinker. Analyze the provided data, text, numbers, or arguments. Find patterns, point out flaws, extract insights, and structure your findings clearly.",
    generateDesc: "You are an expert copywriter. Generate a highly engaging, professional, and SEO-friendly description for the product, service, or subject provided by the user.",
    generateAudio: "You are a scriptwriter. Write a conversational, natural-sounding response meant to be spoken out loud. Do not include stage directions, markdown formatting, or speaker labels, just the spoken words."
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
    // Using Browser Native TTS for testing
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;
    
    setIsLoading(true);
    setResponse('');
    setIsDropdownOpen(false);
    window.speechSynthesis.cancel(); 
    setIsSpeaking(false);

    try {
      // Look for the secret in the browser's local memory
      const secretToken = localStorage.getItem('admin_bypass_key') || '';

      const apiResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Send the secret token to the backend
          'x-admin-bypass': secretToken 
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompts[currentMode] },
            { role: 'user', content: inputText }
          ]
        })
      });

      const data = await apiResponse.json();
      
      // Handle our custom rate-limit error message from the backend
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
  }; // <--- THIS is what was missing! The closing brackets for catch, finally, and the function.

  // Dynamic Placeholder Logic
  let inputPlaceholder = `Enter text or data to ${currentMode}...`;
  if (currentMode === 'summarize' && videoId) {
    inputPlaceholder = "Video detected! Paste the video transcript here so I can summarize it...";
  } else if (currentMode === 'summarize') {
    inputPlaceholder = "Paste an article, text, or a YouTube link here...";
  }

  return (
    <div className="ai-utility-section">
      <div className="chat-input-container" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        
        {/* ✨ NEW: The Video Preview Player */}
        {videoId && currentMode === 'summarize' && (
          <div className="video-preview-wrapper" style={{ width: '100%', marginBottom: '1rem', padding: '0.5rem' }}>
            <iframe
              width="100%"
              height="250"
              src={`https://www.youtube.com/embed/${videoId}`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}
            ></iframe>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', width: '100%' }}>
          {/* Dropdown Menu */}
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

          {/* Text Area */}
          <textarea 
            id="question-input" 
            placeholder={inputPlaceholder}
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

          {/* Send Button */}
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

      {/* Output Display */}
      {response && (
        <div className="ai-response-card">
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
    </div>
  );
};

export default AIComparison;