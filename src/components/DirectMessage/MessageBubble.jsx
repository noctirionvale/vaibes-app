import React, { useState } from 'react'

const MessageBubble = ({ message, isOwn }) => {
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)

  const time = new Date(message.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })

  return (
    <div className={`dm-bubble-wrap ${isOwn ? 'own' : 'other'}`}>
      <div className={`dm-bubble ${isOwn ? 'own' : 'other'}`}
        style={{ padding: message.image_url ? '0.4rem' : undefined }}
      >
        {/* Image */}
        {message.image_url && !imgError && (
          <img
            src={message.image_url}
            alt="Shared by user"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            style={{
              display: 'block',
              maxWidth: '220px',
              width: '100%',
              borderRadius: '10px',
              opacity: imgLoaded ? 1 : 0,
              transition: 'opacity 0.2s ease',
              marginBottom: message.content ? '0.4rem' : 0,
              cursor: 'pointer'
            }}
            onClick={() => window.open(message.image_url, '_blank')}
          />
        )}

        {/* Broken image fallback */}
        {message.image_url && imgError && (
          <div style={{
            padding: '0.4rem 0.6rem',
            fontSize: '0.75rem',
            opacity: 0.6
          }}>
            📷 Image unavailable
          </div>
        )}

        {/* Text / caption */}
        {message.content && (
          <div style={{ padding: message.image_url ? '0 0.4rem 0.2rem' : undefined }}>
            {message.content}
          </div>
        )}
      </div>
      <div className="dm-bubble-time">{time}</div>
    </div>
  )
}

export default MessageBubble