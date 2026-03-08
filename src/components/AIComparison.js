import React, { useState } from 'react';
import { fetchAIResponse } from '../services/api';

const AIComparison = () => {
  const [question, setQuestion] = useState('');
  const [task, setTask] = useState('explain'); // New state for task
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const tasks = {
    explain: 'Explain this in simple terms',
    generate: 'Generate content about this',
    summarize: 'Summarize this topic',
    describe: 'Create a detailed description',
    analyze: 'Analyze and provide insights'
  };

  const handleSubmit = async () => {
    if (!question.trim()) {
      setError('Please enter something');
      return;
    }

    setLoading(true);
    setError('');
    setResponses([]);

    try {
      const fullPrompt = `${tasks[task]}: ${question}`;
      const aiResponses = await fetchAIResponse(fullPrompt);
      setResponses(aiResponses);
    } catch (err) {
      setError('Failed to fetch responses. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="ai-comparison" className="section-padding">
      <div className="section-header">
        <h2>AI Powered Tools</h2>
        <p>Choose a task and let AI help you explore ideas.</p>
      </div>

      <div className="api-notice">
        💡 Powered by DeepSeek AI - Advanced AI capabilities
      </div>

      {/* Task Selector */}
      <div className="ai-task-selector">
        <label htmlFor="task-select">Choose a task:</label>
        <select 
          id="task-select" 
          value={task} 
          onChange={(e) => setTask(e.target.value)}
        >
          <option value="explain">🎓 Explain</option>
          <option value="generate">✍️ Generate</option>
          <option value="summarize">📋 Summarize</option>
          <option value="describe">🖼️ Describe</option>
          <option value="analyze">🔍 Analyze</option>
        </select>
      </div>

      <div className="ai-input-section">
        <textarea
          id="question-input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask anything or paste content here..."
          onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
        />
        <button id="submit-btn" onClick={handleSubmit} disabled={loading}>
          {loading ? '⏳' : '✈️ Send'}
        </button>
      </div>

      {error && (
        <div className="ai-error-box" style={{display: 'block'}}>
          {error}
        </div>
      )}

      {loading && (
        <div className="ai-loading" style={{display: 'block'}}>
          <p>🔄 Processing...</p>
        </div>
      )}

      {responses.length > 0 && (
        <div className="ai-responses-grid">
          {responses.map((response, index) => (
            <div key={index} className="ai-response-card" style={{borderLeft: `4px solid ${response.color}`}}>
              <div className="ai-response-header">
                <span className="ai-response-icon">{response.icon}</span>
                <div>
                  <div className="ai-response-title" style={{color: response.color}}>
                    {response.name}
                  </div>
                </div>
              </div>
              <div className="ai-response-text">{response.text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AIComparison;