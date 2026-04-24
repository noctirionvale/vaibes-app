import React, { useState } from 'react'
import ConversationList from './ConversationList'
import ChatWindow from './ChatWindow'
import './DirectMessage.css'

const DirectMessage = ({ onClose }) => {
  const [activeConversation, setActiveConversation] = useState(null)
  const [activeUser, setActiveUser] = useState(null)

  return (
    <div className="dm-container">
      <div className="dm-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {activeConversation && (
            <button
              onClick={() => { setActiveConversation(null); setActiveUser(null) }}
              style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1rem', padding: '0 0.25rem', display: 'flex', alignItems: 'center' }}
            >←</button>
          )}
          <h3>
            {activeConversation
              ? (activeUser?.display_name || activeUser?.username || 'Chat')
              : 'Messages'}
          </h3>
          {activeConversation && activeUser?.username && (
            <span style={{ fontSize: '0.72rem', color: 'var(--accent2)', marginTop: '1px' }}>
              @{activeUser.username}
            </span>
          )}
        </div>
        <button onClick={onClose} className="dm-close">✕</button>
      </div>

      <div className="dm-body">
        <ConversationList
          onSelect={(conv, user) => {
            setActiveConversation(conv)
            setActiveUser(user)
          }}
          activeId={activeConversation?.id}
        />
        {activeConversation ? (
          <ChatWindow
            conversation={activeConversation}
            otherUser={activeUser}
            onBack={() => {
              setActiveConversation(null)
              setActiveUser(null)
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
  )
}

export default DirectMessage