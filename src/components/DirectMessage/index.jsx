import React, { useState } from 'react';
import ConversationList from './ConversationList';
import ChatWindow from './ChatWindow';
import './DirectMessage.css';

const DirectMessage = ({ onClose, userTier = 'free' }) => {
  const [activeConversation, setActiveConversation] = useState(null);
  const [activeUser, setActiveUser] = useState(null);

  // Pro paywall for free users
  if (userTier !== 'pro') {
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
              // Close DM modal and open settings billing tab, or redirect to upgrade page
              onClose();
              // You can also trigger a global event or pass a callback
              window.location.href = '/app?tab=billing'; // adjust as needed
            }}
          >
            Upgrade to Pro
          </button>
          <p className="dm-paywall-note">✨ Free users can still view wallpapers, live cams, and Study Mode.</p>
        </div>
      </div>
    );
  }

  // For Pro users, show the full DM interface
  return (
    <div className="dm-container">
      <div className="dm-header">
        <h3>Messages</h3>
        <button onClick={onClose} className="dm-close">✕</button>
      </div>
      <div className="dm-body">
        <ConversationList
          onSelect={(conv, user) => {
            setActiveConversation(conv);
            setActiveUser(user);
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