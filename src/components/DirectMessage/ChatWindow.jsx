import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import MessageBubble from './MessageBubble'

const ChatWindow = ({ conversation, otherUser, onBack }) => {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  // Fetch messages
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

    // ✅ Realtime subscription
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

  // Auto scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || sending) return
    setSending(true)

    try {
      await supabase.from('dm_messages').insert({
        conversation_id: conversation.id,
        sender_id: user.id,
        content: input.trim()
      })

      // Update last message in conversation
      await supabase
        .from('dm_conversations')
        .update({
          last_message: input.trim(),
          last_message_at: new Date().toISOString()
        })
        .eq('id', conversation.id)

      setInput('')
    } catch (err) {
      console.error('Send error:', err)
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
              </div>
          }
        </div>
        <div className="dm-chat-user-info">
          <div className="dm-chat-username">
            {otherUser?.display_name || 'User'}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="dm-messages">
        {messages.length === 0 ? (
          <div className="dm-messages-empty">
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👋</div>
            <p>Say hello to {otherUser?.display_name}!</p>
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

      {/* Input */}
      <div className="dm-input-row">
        <input
          type="text"
          placeholder="Type a message..."
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
          disabled={!input.trim() || sending}
          className="dm-send-btn"
        >
          {sending ? '...' : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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