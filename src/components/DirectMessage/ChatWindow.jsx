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
  
  // Grouped file state to prevent mismatched renders
  const [fileData, setFileData] = useState({ file: null, preview: null })
  
  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, fileData.preview, scrollToBottom])

  // Fetch & Subscribe
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
      .channel(`dm_messages_${conversation.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'dm_messages',
        filter: `conversation_id=eq.${conversation.id}`
      }, (payload) => {
        // Prevent duplicate messages if the sender is us (Optimistic UI handles our own)
        setMessages(prev => {
          const exists = prev.find(m => m.id === payload.new.id);
          if (exists) return prev;
          return [...prev, payload.new];
        })
      })
      .subscribe()

    return () => {
      sub.unsubscribe()
    }
  }, [conversation?.id])

  // Improved Image Handling (No Memory Leaks)
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be under 5MB.')
      return
    }

    // Clean up previous preview to prevent memory leaks
    if (fileData.preview) URL.revokeObjectURL(fileData.preview)

    setFileData({
      file,
      preview: URL.createObjectURL(file) // Much faster than FileReader
    })
  }

  const clearImage = useCallback(() => {
    if (fileData.preview) URL.revokeObjectURL(fileData.preview)
    setFileData({ file: null, preview: null })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [fileData.preview])

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (fileData.preview) URL.revokeObjectURL(fileData.preview)
    }
  }, [fileData.preview])

  const uploadImage = async (fileToUpload) => {
    // Generate secure, collision-proof filename
    const ext = fileToUpload.name.split('.').pop() || 'png'
    const fileName = `${crypto.randomUUID()}.${ext}`
    const path = `${conversation.id}/${user.id}-${fileName}`
    
    const { error } = await supabase.storage
      .from('DM-IMAGES')
      .upload(path, fileToUpload, { upsert: false })
      
    if (error) throw error
    
    const { data } = supabase.storage.from('DM-IMAGES').getPublicUrl(path)
    return data.publicUrl
  }

  const handleSend = async () => {
    const messageText = input.trim()
    const currentFile = fileData.file

    if ((!messageText && !currentFile) || sending) return
    
    setSending(true)
    if (currentFile) setUploadingImage(true)

    // Optimistic UI Update: Create a temporary message to render instantly
    const tempId = `temp-${Date.now()}`
    const tempMessage = {
      id: tempId,
      conversation_id: conversation.id,
      sender_id: user.id,
      content: messageText || null,
      image_url: fileData.preview, // Use local preview temporarily
      created_at: new Date().toISOString()
    }
    
    setMessages(prev => [...prev, tempMessage])
    setInput('')
    clearImage() // Clear input instantly for better UX

    try {
      let imageUrl = null
      if (currentFile) {
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

      // Swap temp message with real database message
      setMessages(prev => prev.map(m => m.id === tempId ? finalMessage : m))

      // Fire-and-forget conversation update
      supabase.from('dm_conversations').update({
        last_message: imageUrl ? (messageText || '📷 Photo') : messageText,
        last_message_at: new Date().toISOString()
      }).eq('id', conversation.id).then()

    } catch (err) {
      console.error('Send error:', err)
      // Revert optimistic update on failure
      setMessages(prev => prev.filter(m => m.id !== tempId))
      alert("Failed to send message. Please try again.")
    } finally {
      setSending(false)
      setUploadingImage(false)
    }
  }

  // ... Rest of your JSX render logic remains the same, 
  // just replace `imagePreview` with `fileData.preview` and `imageFile` with `fileData.file` in the JSX.