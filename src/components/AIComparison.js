import React, { useState } from 'react';
import { fetchAIResponse, TEXT_LIMITS } from '../services/api';

const AIComparison = () => {
  const [question, setQuestion] = useState('');
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleQuestionChange = (e) => {
    const value = e.target.value;
    if (value.length <= TEXT_LIMITS.questionMax) {
      setQuestion(value);
    }
  };

  const handleSubmit = async () => {
    if (!question.trim()) {
      setError('Please enter a question');
      return;
    }

    if (question.length > TEXT_LIMITS.questionMax) {
      setError(`Question must be under ${TEXT_LIMITS.questionMax} characters`);
      return;
    }

    setLoading(true);
    setError('');
    setResponses([]); 

    try {
      const aiResponses = await fetchAIResponse(question);
      setResponses(aiResponses);
    } catch (err) {
      setError('Failed to fetch responses. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAskAnother = () => {
    setQuestion('');
    setResponses([]);
    setError('');
  };

  const charCount = question.length;
  const maxChars = TEXT_LIMITS.questionMax;
  const percentage = (charCount / maxChars) * 100;
  const isNearLimit = percentage > 80;

  return (
    <div id="ai-comparison" className="section-padding">
      <div className="section-header">
        <h2>AI Perspective Comparison</h2>
        <p>Ask any question and see how different AI perspectives would answer it. No single answer is "correct" - understanding comes from comparing viewpoints.</p>
      </div>

      <div className="api-notice">
        💡 Using Deepseek API - Advanced AI perspective comparison
      </div>

      <div className="ai-input-section">
        {/* NEW WRAPPER: Handles the border and background */}
        <div 
          style={{ 
            position: 'relative', 
            marginBottom: '1rem',
            borderRadius: '8px',
            border: '1px solid rgba(0, 229, 255, 0.3)',
            background: 'rgba(15, 15, 25, 0.8)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* TEXTAREA: Transparent, no borders */}
          <textarea
            id="question-input"
            value={question}
            onChange={handleQuestionChange}
            placeholder={`Ask anything... (e.g., 'How does AI actually work?' or 'Should I be worried about AI?')`}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
            style={{
              width: '100%',
              minHeight: '120px',
              padding: '16px',
              paddingBottom: '0', 
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#fff',
              fontSize: '1rem',
              fontFamily: 'inherit',
              resize: 'vertical',
              boxSizing: 'border-box'
            }}
          />
          
          {/* FOOTER: Holds counter and progress bar */}
          <div style={{ position: 'relative', width: '100%', padding: '8px 12px', boxSizing: 'border-box' }}>
            <div 
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                fontSize: '0.8rem',
                color: isNearLimit ? '#ff4fd8' : 'rgba(255, 255, 255, 0.5)',
                fontWeight: '600',
                marginBottom: '6px'
              }}
            >
              {charCount} / {maxChars}
            </div>

            {/* Progress Bar attached to bottom of wrapper */}
            <div 
              style={{
                position: 'absolute',
                bottom: '0',
                left: '0',
                right: '0',
                height: '4px',
                background: 'rgba(255, 255, 255, 0.1)',
              }}
            >
              <div 
                style={{
                  height: '100%',
                  width: `${Math.min(percentage, 100)}%`,
                  background: isNearLimit 
                    ? 'linear-gradient(90deg, #ff4fd8, #00e5ff)' 
                    : 'linear-gradient(90deg, #6a5cff, #00e5ff)',
                  transition: 'width 0.3s ease',
                  boxShadow: '0 0 10px rgba(0, 229, 255, 0.5)'
                }}
              />
            </div>
          </div>
        </div>

        <button 
          id="submit-btn" 
          onClick={handleSubmit} 
          disabled={loading || charCount === 0}
          style={{
            width: '100%',
            padding: '12px 24px',
            marginTop: '0.5rem',
            borderRadius: '8px',
            border: 'none',
            background: loading || charCount === 0 
              ? 'rgba(0, 229, 255, 0.3)' 
              : 'linear-gradient(135deg, #6a5cff, #00e5ff)',
            color: '#fff',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: loading || charCount === 0 ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease',
            opacity: loading || charCount === 0 ? 0.6 : 1
          }}
        >
          {loading ? '🔄 Analyzing...' : '✨ Compare'}
        </button>
      </div>

      {error && (
        <div id="error-box" className="ai-error-box" style={{display: 'block', color: '#ff4fd8', marginTop: '10px'}}>
          {error}
        </div>
      )}

      {loading && (
        <div id="loading" className="ai-loading" style={{display: 'block', marginTop: '20px', textAlign: 'center'}}>
          <p>🔄 Analyzing from different perspectives...</p>
        </div>
      )}

      {responses.length > 0 && (
        <div id="responses-grid" className="ai-responses-grid">
          {responses.map((response, index) => (
            <div key={index} className="ai-response-card" style={{borderLeft: `4px solid ${response.color}`}}>
              <div className="ai-response-header">
                <span className="ai-response-icon">{response.icon}</span>
                <div>
                  <div className="ai-response-title" style={{color: response.color}}>
                    {response.name}
                  </div>
                  <div className="ai-response-desc">{response.description}</div>
                </div>
              </div>
              <div className="ai-response-text">{response.text}</div>
            </div>
          ))}
        </div>
      )}

      {responses.length > 0 && (
        <div id="cta-footer" className="ai-cta-footer" style={{display: 'block', marginTop: '2rem'}}>
          <h3>Still confused? That's okay.</h3>
          <p>Understanding AI takes time. Join our community of late bloomers exploring technology together.</p>
          <button id="ask-another" onClick={handleAskAnother}>
            Ask Another Question
          </button>
        </div>
      )}
    </div>
  );
};

export default AIComparison;