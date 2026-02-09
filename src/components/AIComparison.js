import React, { useState } from 'react';
import { fetchAIResponse } from '../services/api';

const AIComparison = () => {
  const [question, setQuestion] = useState('');
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!question.trim()) {
      setError('Please enter a question');
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
  };

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
        <textarea
          id="question-input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask anything... (e.g., 'How does AI actually work?' or 'Should I be worried about AI?')"
          onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
        />
        <button id="submit-btn" onClick={handleSubmit} disabled={loading}>
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