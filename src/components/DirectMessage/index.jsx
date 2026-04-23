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
        <h3>Messages</h3>
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