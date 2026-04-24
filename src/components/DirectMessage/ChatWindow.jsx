import React, { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import MessageBubble from './MessageBubble'

const ChatWindow = ({ conversation, otherUser, onBack }) => {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  
  const [fileData, setFileData] = useState({ file: null, preview: null })
  
  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior })
  }, [])

  // Initial scroll and update scroll
  useEffect(() => {
    scrollToBottom(messages.length <= 1 ? 'auto' : 'smooth')
  }, [messages, fileData.preview, scrollToBottom])

  // Fetch & Real-time Subscription
  useEffect(() => {
    if (!conversation?.id) return

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('dm_messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true })
      
      if (!error && data) setMessages(data)
    }
    
    fetchMessages()

    const sub = supabase
      .channel(`dm_messages:${conversation.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'dm_messages',
        filter: `conversation_id=eq.${conversation.id}`
      }, (payload) => {
        setMessages(prev => {
          if (prev.some(m => m.id === payload.new.id)) return prev
          return [...prev, payload.new]
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(sub)
    }
  }, [conversation?.id])

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (!file.type.startsWith('image/')) return alert('Please select an image.')
    if (file.size > 5 * 1024 * 1024) return alert('Image must be under 5MB.')

    if (fileData.preview) URL.revokeObjectURL(fileData.preview)
    setFileData({ file, preview: URL.createObjectURL(file) })
  }

  const clearImage = useCallback(() => {
    if (fileData.preview) URL.revokeObjectURL(fileData.preview)
    setFileData({ file: null, preview: null })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [fileData.preview])

  const uploadImage = async (fileToUpload) => {
    const ext = fileToUpload.name.split('.').pop() || 'png'
    const path = `${conversation.id}/${crypto.randomUUID()}.${ext}`
    
    const { error } = await supabase.storage
      .from('DM-IMAGES')
      .upload(path, fileToUpload)
      
    if (error) throw error
    const { data } = supabase.storage.from('DM-IMAGES').getPublicUrl(path)
    return data.publicUrl
  }

  const handleSend = async (e) => {
    e?.preventDefault()
    const messageText = input.trim()
    const currentFile = fileData.file

    if ((!messageText && !currentFile) || sending) return
    
    setSending(true)
    const tempId = `temp-${Date.now()}`
    const tempMessage = {
      id: tempId,
      conversation_id: conversation.id,
      sender_id: user.id,
      content: messageText || null,
      image_url: fileData.preview,
      created_at: new Date().toISOString(),
      isOptimistic: true
    }
    
    setMessages(prev => [...prev, tempMessage])
    setInput('')
    clearImage()

    try {
      let imageUrl = null
      if (currentFile) {
        setUploadingImage(true)
        imageUrl = await uploadImage(currentFile)
      }

      const { data: finalMessage, error: insertError } = await supabase
        .from('dm_messages')
        .insert({
          conversation_id: conversation.id,
          sender_id: user.id,
          content: messageText || null,
          image_url: imageUrl
        })
        .select()
        .single()

      if (insertError) throw insertError
      setMessages(prev => prev.map(m => m.id === tempId ? finalMessage : m))

      // Update conversation metadata
      await supabase.from('dm_conversations').update({
        last_message: imageUrl ? (messageText || '📷 Photo') : messageText,
        last_message_at: new Date().toISOString()
      }).eq('id', conversation.id)

    } catch (err) {
      console.error('Send error:', err)
      setMessages(prev => prev.filter(m => m.id !== tempId))
      alert("Failed to send message.")
    } finally {
      setSending(false)
      setUploadingImage(false)
    }
  }

  // ✅ This is the return statement – note the closing brace below
  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Header */}
      <div className="flex items-center p-4 border-b">
        <button onClick={onBack} className="mr-4 p-2 hover:bg-gray-100 rounded-full">←</button>
        <div className="flex flex-col">
          <h2 className="font-bold leading-tight">{otherUser?.full_name || 'Chat'}</h2>
          {uploadingImage && (
            <span className="text-xs text-blue-500 animate-pulse">Uploading image...</span>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} isMe={msg.sender_id === user.id} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t bg-gray-50">
        {fileData.preview && (
          <div className="relative inline-block mb-2">
            <img 
              src={fileData.preview} 
              alt="Preview" 
              className={`h-20 w-20 object-cover rounded-lg border ${uploadingImage ? 'opacity-50' : 'opacity-100'}`} 
            />
            {!uploadingImage && (
              <button 
                onClick={clearImage}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-sm hover:bg-red-600"
              >
                ×
              </button>
            )}
          </div>
        )}
        
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <button 
            type="button"
            disabled={sending}
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-gray-500 hover:text-blue-500 disabled:opacity-30"
          >
            📷
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageSelect} 
            accept="image/*" 
            className="hidden" 
          />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={uploadingImage ? "Sending image..." : "Type a message..."}
            className="flex-1 p-2 border rounded-full px-4 outline-none focus:border-blue-400 disabled:bg-gray-100"
            disabled={sending}
          />
          <button 
            type="submit"
            disabled={(!input.trim() && !fileData.file) || sending}
            className="bg-blue-600 text-white px-4 py-2 rounded-full disabled:opacity-50 font-medium transition-colors"
          >
            {sending ? '...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  )
}  // ✅ This closing brace was missing!

export default ChatWindow