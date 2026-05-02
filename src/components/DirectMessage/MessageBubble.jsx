import React, { useState } from 'react'

const MessageBubble = ({ message, isOwn, onDelete, onDownload }) => {
  const [lightbox, setLightbox] = useState(false)

  const time = new Date(message.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })

  return (
    <div className={`dm-bubble-wrap ${isOwn ? 'own' : 'other'}`}>
      <div className={`dm-bubble ${isOwn ? 'own' : 'other'}`}>
        {message.image_url && (
          <>
            <img
              src={message.image_url}
              alt="shared"
              style={{
                maxWidth: '220px',
                maxHeight: '220px',
                borderRadius: '10px',
                display: 'block',
                marginBottom: message.content ? '0.4rem' : 0,
                cursor: 'zoom-in',
                objectFit: 'cover'
              }}
              onClick={() => setLightbox(true)}
            />

            {lightbox && (
              <div
                onClick={() => setLightbox(false)}
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0,0,0,0.92)',
                  zIndex: 99999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'zoom-out',
                  padding: '1rem'
                }}
              >
                <img
                  src={message.image_url}
                  alt="full"
                  style={{
                    maxWidth: '90vw',
                    maxHeight: '90vh',
                    borderRadius: '12px',
                    objectFit: 'contain',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
                  }}
                  onClick={e => e.stopPropagation()}
                />
                <button
                  onClick={() => setLightbox(false)}
                  style={{
                    position: 'absolute',
                    top: '1rem',
                    right: '1rem',
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: 'white',
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >✕</button>
              </div>
            )}
          </>
        )}

        {message.content && (
          <span>{message.content}</span>
        )}
      </div>

      <div className="dm-bubble-bottom">
        <div className="dm-bubble-time">{time}</div>
        <div className="dm-bubble-actions">
          {message.image_url && (
            <button
              className="dm-download-btn"
              onClick={() => onDownload?.(message.image_url)}
              title="Download image"
            >
              📥
            </button>
          )}
          {isOwn && (
            <button
              className="dm-delete-btn"
              onClick={() => onDelete?.(message.id)}
              title="Delete message"
            >
              🗑️
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default MessageBubble