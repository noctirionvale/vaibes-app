import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import MessageBubble from './MessageBubble'

const ChatWindow = ({ conversation, otherUser, onBack }) => {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imagePreview, setImagePreview] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!conversation?.id) return
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('dm_messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true })
      setMessages(data || [])
    }
    fetchMessages()

    const sub = supabase
      .channel(`dm_messages_${conversation.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'dm_messages',
        filter: `conversation_id=eq.${conversation.id}`
      }, (payload) => {
        setMessages(prev => [...prev, payload.new])
      })
      .subscribe()
    return () => sub.unsubscribe()
  }, [conversation?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleImageSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be under 5MB.')
      return
    }
    setImageFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setImagePreview(reader.result)
    reader.readAsDataURL(file)
  }

  const clearImage = () => {
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const uploadImage = async () => {
    if (!imageFile) return null
    const ext = imageFile.name.split('.').pop()
    const path = `${conversation.id}/${user.id}-${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('dm-images')
      .upload(path, imageFile, { upsert: false })
    if (error) throw error
    const { data } = supabase.storage.from('dm-images').getPublicUrl(path)
    return data.publicUrl
  }

  const handleSend = async () => {
    if ((!input.trim() && !imageFile) || sending) return
    setSending(true)
    if (imageFile) setUploadingImage(true)

    try {
      let imageUrl = null
      if (imageFile) {
        imageUrl = await uploadImage()
        setUploadingImage(false)
      }

      await supabase.from('dm_messages').insert({
        conversation_id: conversation.id,
        sender_id: user.id,
        content: input.trim() || null,
        image_url: imageUrl
      })

      await supabase.from('dm_conversations').update({
        last_message: imageUrl ? (input.trim() || '📷 Photo') : input.trim(),
        last_message_at: new Date().toISOString()
      }).eq('id', conversation.id)

      setInput('')
      clearImage()
    } catch (err) {
      console.error('Send error:', err)
      setUploadingImage(false)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="dm-chat-window">
      {/* Header */}
      <div className="dm-chat-header">
        <button className="dm-back-btn" onClick={onBack}>←</button>
        <div className="dm-avatar small">
          {otherUser?.avatar_url
            ? <img src={otherUser.avatar_url} alt="" />
            : <div className="dm-avatar-placeholder small">
                {otherUser?.display_name?.[0]?.toUpperCase() || '?'}
              </div>}
        </div>
        <div className="dm-chat-user-info">
          <div className="dm-chat-username">
            {otherUser?.display_name || otherUser?.username || 'User'}
          </div>
          {otherUser?.username && (
            <div style={{ fontSize: '0.7rem', color: 'var(--accent2)' }}>
              @{otherUser.username}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="dm-messages">
        {messages.length === 0 ? (
          <div className="dm-messages-empty">
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👋</div>
            <p>Say hello to {otherUser?.display_name || otherUser?.username}!</p>
          </div>
        ) : (
          messages.map(msg => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwn={msg.sender_id === user?.id}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Image preview above input */}
      {imagePreview && (
        <div style={{
          padding: '0.5rem 1rem 0 1rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.5rem'
        }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <img
              src={imagePreview}
              alt="Preview"
              style={{
                maxHeight: '80px',
                maxWidth: '120px',
                borderRadius: '8px',
                objectFit: 'cover',
                border: '1px solid rgba(255,255,255,0.15)'
              }}
            />
            <button
              onClick={clearImage}
              style={{
                position: 'absolute', top: '-6px', right: '-6px',
                width: '18px', height: '18px', borderRadius: '50%',
                background: '#ff4fd8', border: 'none', color: 'white',
                fontSize: '0.6rem', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, lineHeight: 1
              }}
            >✕</button>
          </div>
          {uploadingImage && (
            <span style={{ fontSize: '0.75rem', color: 'var(--accent2)', alignSelf: 'center' }}>
              Uploading...
            </span>
          )}
        </div>
      )}

      {/* Input row */}
      <div className="dm-input-row">
        {/* Photo button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          title="Send photo"
          style={{
            width: '36px', height: '36px', borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.1)',
            background: imageFile ? 'rgba(106,92,255,0.2)' : 'rgba(255,255,255,0.05)',
            color: imageFile ? 'var(--accent1)' : 'var(--muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s ease'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleImageSelect}
        />

        <input
          type="text"
          placeholder={imageFile ? 'Add a caption...' : 'Type a message...'}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          className="dm-input"
        />

        <button
          onClick={handleSend}
          disabled={(!input.trim() && !imageFile) || sending}
          className="dm-send-btn"
        >
          {sending ? '...' : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}

export default ChatWindow