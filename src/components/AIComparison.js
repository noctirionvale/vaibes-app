import React, { useState } from 'react';
import { fetchAIResponse, TEXT_LIMITS } from '../services/api';

const AIComparison = () => {
  const [question, setQuestion] = useState('');
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleQuestionChange = (e) => {
    const value = e.target.value;
    // Limit to max characters
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

  // Calculate character count and percentage
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
        <div style={{ position: 'relative' }}>
          <textarea
            id="question-input"
            value={question}
            onChange={handleQuestionChange}
            placeholder={`Ask anything... (e.g., 'How does AI actually work?' or 'Should I be worried about AI?')\n\nMax ${maxChars} characters`}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
            style={{
              width: '100%',
              minHeight: '120px',
              paddingBottom: '40px' // Space for counter
            }}
          />
          
          {/* Character Counter */}
          <div 
            style={{
              position: 'absolute',
              bottom: '10px',
              right: '15px',
              fontSize: '0.85rem',
              color: isNearLimit ? '#ff4fd8' : '#00e5ff',
              fontWeight: '600',
              transition: 'color 0.3s ease'
            }}
          >
            {charCount} / {maxChars}
          </div>

          {/* Progress Bar */}
          <div 
            style={{
              position: 'absolute',
              bottom: '0',
              left: '0',
              right: '0',
              height: '3px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '0 0 8px 8px',
              overflow: 'hidden'
            }}
          >
            <div 
              style={{
                height: '100%',
                width: `${Math.min(percentage, 100)}%`,
                background: isNearLimit 
                  ? 'linear-gradient(90deg, #00e5ff, #ff4fd8)' 
                  : 'linear-gradient(90deg, #00e5ff, #6a5cff)',
                transition: 'width 0.3s ease'
              }}
            />
          </div>
        </div>

        <button 
          id="submit-btn" 
          onClick={handleSubmit} 
          disabled={loading || charCount === 0}
          style={{
            marginTop: '1rem',
            opacity: loading || charCount === 0 ? 0.6 : 1,
            cursor: loading || charCount === 0 ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Analyzing...' : 'Compare'}
        </button>
      </div>

      {error && (
        <div id="error-box" className="ai-error-box" style={{display: 'block'}}>
          {error}
        </div>
      )}

      {loading && (
        <div id="loading" className="ai-loading" style={{display: 'block'}}>
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
        <div id="cta-footer" className="ai-cta-footer" style={{display: 'block', marginTop: '1rem'}}>
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