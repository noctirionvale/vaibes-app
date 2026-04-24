import React from 'react'

const MessageBubble = ({ message, isOwn }) => {
  const time = new Date(message.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })

  return (
    <div className={`dm-bubble-wrap ${isOwn ? 'own' : 'other'}`}>
      <div className={`dm-bubble ${isOwn ? 'own' : 'other'}`}>

        {/* ✅ Show image if present */}
        {message.image_url && (
          <img
            src={message.image_url}
            alt="shared"
            style={{
              maxWidth: '220px',
              maxHeight: '220px',
              borderRadius: '10px',
              display: 'block',
              marginBottom: message.content ? '0.4rem' : 0,
              cursor: 'pointer',
              objectFit: 'cover'
            }}
            onClick={() => window.open(message.image_url, '_blank')}
          />
        )}

        {/* ✅ Show text if present */}
        {message.content && (
          <span>{message.content}</span>
        )}
      </div>
      <div className="dm-bubble-time">{time}</div>
    </div>
  )
}

export default MessageBubble