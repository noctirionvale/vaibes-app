import React, { useState, useEffect, useRef } from 'react';

const AIComparison = () => {
  const [inputText, setInputText] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const [currentMode, setCurrentMode] = useState('explain');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // ✨ NEW: Create a reference to our dropdown container
  const dropdownRef = useRef(null);

  // ✨ NEW: Listen for clicks outside the dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      // If the click is OUTSIDE the element our ref is attached to, close the menu
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    // Bind the event listener to the whole document
    document.addEventListener('mousedown', handleClickOutside);
    
    // Cleanup the event listener when the component unmounts
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // The brains: dynamically changing how DeepSeek acts
  const systemPrompts = {
    explain: "You are a clear, logical teacher. Explain the user's prompt simply and accurately without hype or jargon.",
    summarize: "You are an expert editor. Summarize the following text concisely, highlighting only the most important main points.",
    describe: "You are a highly observant writer. Provide a detailed, vivid, and structured description based on the prompt.",
    analyze: "You are an analytical thinker. Break down the user's input, exploring its components, logic, strengths, and weaknesses.",
    generateDescription: "You are a creative assistant. Generate the requested description format based exactly on the user's prompt.",
    generateAudio: "You are a scriptwriter. Write a conversational, natural-sounding response meant to be spoken out loud. Do not include stage directions, markdown formatting, or speaker labels, just the spoken words."
  };

  const modeLabels = {
    explain: "Explain Concept",
    summarize: "Summarize Text",
    describe: "Describe Details",
    analyze: "Analyze Input",
    generateDescription: "Generate Description",
    generateAudio: "Generate Audio (TTS)"
  };

  // Audio Playback Handler
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
    
    // Stop any currently playing audio if they send a new message
    window.speechSynthesis.cancel(); 
    setIsSpeaking(false);

    try {
      const apiResponse = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer YOUR_DEEPSEEK_API_KEY_HERE` // <-- ADD YOUR KEY HERE
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompts[currentMode] },
            { role: 'user', content: inputText }
          ],
          temperature: 0.7
        })
      });

      const data = await apiResponse.json();
      
      if (data.choices && data.choices.length > 0) {
        const replyText = data.choices[0].message.content;
        setResponse(replyText);
        
        // Trigger audio automatically if in Audio Mode
        if (currentMode === 'generateAudio') {
          handleAudioPlayback(replyText);
        }
      } else {
        setResponse("Error: Received an unexpected response from DeepSeek.");
      }
    } catch (error) {
      console.error("API Error:", error);
      setResponse("Failed to connect to the AI. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="ai-utility-section">
      {/* The Unified Chat Input Box */}
      <div className="chat-input-container">
        
        {/* ✨ NEW: Attach the ref to the wrapper so React knows where it is */}
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

          {/* The Custom Glass Pop-up Menu */}
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

        {/* The Text Area */}
        <textarea 
          id="question-input" 
          placeholder={`Enter text to ${currentMode}...`}
          value={inputText}
          onChange={(e) => {
            setInputText(e.target.value);
            // Auto-expand textarea logic
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

        {/* The Send Button */}
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

      {/* The Display Area for the AI's Output */}
      {response && (
        <div className="ai-response-card">
          <div className="ai-response-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="current-mode-badge">{modeLabels[currentMode]}</span>
            
            {/* Visual indicator that audio is playing */}
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