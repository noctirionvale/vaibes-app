// StudyMode.jsx
import React, { useState } from 'react';
import StudyModeModal from './StudyModeModal'; // new component
import './StudyMode.css';

const StudyMode = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        className="study-mode-trigger"
        onClick={() => setIsOpen(true)}
        title="Open Study Mode"
      >
        <div className="study-mode-icon">🎓</div>
        <div className="study-mode-label">Study Mode</div>
        <div className="study-mode-equalizer">
          <span></span><span></span><span></span>
        </div>
      </button>

      {isOpen && (
        <div className="modal-overlay" onClick={() => setIsOpen(false)}>
          <div className="study-mode-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🎓 Study Mode</h3>
              <button className="modal-close" onClick={() => setIsOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <StudyModeModal onClose={() => setIsOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default StudyMode;