import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import ConversationList from './ConversationList';
import ChatWindow from './ChatWindow';
import './DirectMessage.css';

const DirectMessage = ({ onClose, userTier = 'free' }) => {
  const [activeConversation, setActiveConversation] = useState(null);
  const [activeUser, setActiveUser] = useState(null);
  const { user } = useAuth();

  // Admin bypass – replace with your email(s)
  const isDev = user?.email === 'noctirionvale@gmail.com';

  // Paywall: only block non-pro AND non-dev users
  if (userTier !== 'pro' && !isDev) {
    return (
      <div className="dm-container">
        <div className="dm-header">
          <h3>Messages</h3>
          <button onClick={onClose} className="dm-close">✕</button>
        </div>
        <div className="dm-paywall">
          <div className="dm-paywall-icon">💬</div>
          <h3>Direct Messages are a Pro Feature</h3>
          <p>Upgrade to Pro to chat with other users, create study groups, and collaborate in real time.</p>
          <button
            className="upgrade-btn"
            onClick={() => {
              onClose();
              window.location.href = '/app?tab=billing';
            }}
          >
            Upgrade to Pro
          </button>
          <p className="dm-paywall-note">✨ Free users can still view wallpapers, live cams, and Study Mode.</p>
        </div>
      </div>
    );
  }

  // For Pro users (or dev), show the full DM interface
  return (
    <div className="dm-container">
      <div className="dm-header">
        <h3>Messages</h3>
        <button onClick={onClose} className="dm-close">✕</button>
      </div>
      <div className="dm-body">
        <ConversationList
          onSelect={(conv, otherUser) => {
            setActiveConversation(conv);
            setActiveUser(otherUser);
          }}
          activeId={activeConversation?.id}
        />
        {activeConversation ? (
          <ChatWindow
            conversation={activeConversation}
            otherUser={activeUser}
            onBack={() => {
              setActiveConversation(null);
              setActiveUser(null);
            }}
          />
        ) : (
          <div className="dm-empty">
            <div className="dm-empty-icon">💬</div>
            <p>Select a conversation</p>
            <span>or start a new one</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default DirectMessage;