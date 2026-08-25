import React from 'react';
import { createPortal } from 'react-dom';
import CommunityRoomPlay from './CommunityRoomPlay';
import './QuizArenaModal.css';

/**
 * QuizArenaModal
 * ─────────────────────────────────────────────────────────────────
 * Drop-in portal modal for the Quiz Arena (CommunityRoomPlay).
 * Renders into document.body so it sits above everything.
 *
 * Props:
 *   roomId   — the community_rooms UUID to load
 *   onClose  — called when the user clicks ✕ or the backdrop
 */
const QuizArenaModal = ({ roomId, onClose }) => {
  if (!roomId) return null;

  return createPortal(
    <div
      className="qam-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Quiz Arena"
    >
      <div
        className="qam-panel"
        onClick={e => e.stopPropagation()}
      >
        <CommunityRoomPlay roomId={roomId} onClose={onClose} />
      </div>
    </div>,
    document.body
  );
};

export default QuizArenaModal;