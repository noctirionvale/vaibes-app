import React from 'react'

const MessageBubble = ({ message, isOwn }) => {
  const time = new Date(message.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })

  return (
    <div className={`dm-bubble-wrap ${isOwn ? 'own' : 'other'}`}>
      <div className={`dm-bubble ${isOwn ? 'own' : 'other'}`}>
        {message.content}
      </div>
      <div className="dm-bubble-time">{time}</div>
    </div>
  )
}

export default MessageBubble