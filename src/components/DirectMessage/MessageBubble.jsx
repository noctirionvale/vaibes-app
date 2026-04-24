import React, { useState } from 'react';

const MessageBubble = ({ message, isOwn }) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <div className={`dm-message-bubble ${isOwn ? 'own-message' : 'other-message'}`}>
      {/* Render Image if it exists */}
      {message.image_url && (
        <div className="dm-message-image-container" style={{ position: 'relative' }}>
          {!imageLoaded && (
            <div className="image-placeholder" style={{ minHeight: '150px', background: 'rgba(255,255,255,0.1)' }}>
              Loading...
            </div>
          )}
          <img 
            src={message.image_url} 
            alt="User uploaded content" 
            className="dm-message-image"
            style={{ 
              maxWidth: '100%', 
              borderRadius: '8px', 
              display: imageLoaded ? 'block' : 'none' 
            }}
            onLoad={() => setImageLoaded(true)}
            loading="lazy"
          />
        </div>
      )}

      {/* Render Text if it exists */}
      {message.content && (
        <p className="dm-message-text" style={{ marginTop: message.image_url ? '8px' : '0' }}>
          {message.content}
        </p>
      )}
    </div>
  );
};

export default MessageBubble;