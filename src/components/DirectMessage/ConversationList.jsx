import React, { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

const ConversationList = ({ onSelect, activeId }) => {
  const { user } = useAuth()
  const [conversations, setConversations] = useState([])
  const [searchResults, setSearchResults] = useState([])
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('chats')
  const [searching, setSearching] = useState(false)
  const [hasUsername, setHasUsername] = useState(true)
  const searchTimer = useRef(null)
  const conversationsRef = useRef(conversations)

  useEffect(() => { conversationsRef.current = conversations }, [conversations])

  const fetchConversations = useCallback(async () => {
    if (!user?.id) return
    const { data } = await supabase
      .from('dm_conversations')
      .select(`
        *,
        user1:profiles!dm_conversations_user1_profile_fkey(
          id, display_name, username, avatar_url
        ),
        user2:profiles!dm_conversations_user2_profile_fkey(
          id, display_name, username, avatar_url
        )
      `)
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .order('last_message_at', { ascending: false })
    if (data) setConversations(data)
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    supabase.from('profiles').select('username')
      .eq('id', user.id).maybeSingle()
      .then(({ data }) => setHasUsername(!!data?.username))
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    fetchConversations()
    const channel = supabase
      .channel(`dm_conversations_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_conversations', filter: `user1_id=eq.${user.id}` }, fetchConversations)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_conversations', filter: `user2_id=eq.${user.id}` }, fetchConversations)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user?.id, fetchConversations])

  useEffect(() => {
    if (tab !== 'people') return
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!search.trim() || search.length < 2) {
      setSearchResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    searchTimer.current = setTimeout(async () => {
      const cleanSearch = search.replace('@', '').trim()
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .eq('is_searchable', true)
        .or(`username.ilike.%${cleanSearch}%,display_name.ilike.%${cleanSearch}%`)
        .neq('id', user.id)
        .limit(20)
      setSearchResults(data || [])
      setSearching(false)
    }, 350)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [search, tab, user?.id])

  const startConversation = async (otherUser) => {
    const existing = conversationsRef.current.find(c =>
      (c.user1_id === user.id && c.user2_id === otherUser.id) ||
      (c.user2_id === user.id && c.user1_id === otherUser.id)
    )
    if (existing) { onSelect(existing, otherUser); setTab('chats'); return }
    const { data, error } = await supabase
      .from('dm_conversations')
      .insert({ user1_id: user.id, user2_id: otherUser.id })
      .select().single()
    if (error) { console.error('Error starting conversation:', error); return }
    if (data) { onSelect(data, otherUser); setTab('chats') }
  }

  const getOtherUser = (conv) =>
    conv.user1_id === user?.id ? conv.user2 : conv.user1

  return (
    <div className="dm-conv-list">
      <div className="dm-tabs">
        <button
          className={`dm-tab ${tab === 'chats' ? 'active' : ''}`}
          onClick={() => setTab('chats')}
        >
          Chats
        </button>
        <button
          className={`dm-tab ${tab === 'people' ? 'active' : ''}`}
          onClick={() => setTab('people')}
        >
          People
        </button>
      </div>

      <div className="dm-search">
        <input
          type="text"
          placeholder={tab === 'chats' ? 'Search chats...' : 'Search name or @username...'}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="dm-search-input"
        />
      </div>

      {tab === 'chats' && (
        <div className="dm-list">
          {conversations.length === 0 ? (
            <div className="dm-list-empty">
              No conversations yet
              <button onClick={() => setTab('people')} className="dm-start-btn">
                Find people →
              </button>
            </div>
          ) : (
            conversations
              .filter(c => {
                const other = getOtherUser(c)
                const term = search.toLowerCase()
                return other?.display_name?.toLowerCase().includes(term)
                  || other?.username?.toLowerCase().includes(term)
              })
              .map(conv => {
                const other = getOtherUser(conv)
                return (
                  <button
                    key={conv.id}
                    className={`dm-conv-item ${activeId === conv.id ? 'active' : ''}`}
                    onClick={() => onSelect(conv, other)}
                  >
                    <div className="dm-avatar">
                      {other?.avatar_url
                        ? <img src={other.avatar_url} alt="" />
                        : <div className="dm-avatar-placeholder">
                            {other?.display_name?.[0]?.toUpperCase() || '?'}
                          </div>}
                    </div>
                    <div className="dm-conv-info">
                      <div className="dm-conv-name">{other?.display_name || other?.username || 'User'}</div>
                      <div className="dm-conv-last">
                        {other?.username && (
                          <span style={{ color: 'var(--accent1)', marginRight: '0.25rem' }}>
                            @{other.username}
                          </span>
                        )}
                        {conv.last_message || 'Start a conversation'}
                      </div>
                    </div>
                  </button>
                )
              })
          )}
        </div>
      )}

      {tab === 'people' && (
        <div className="dm-list">
          {!hasUsername && (
            <div className="dm-list-empty">
              <span style={{ fontSize: '1.5rem' }}>🔒</span>
              <span>Set a username in your profile to find and message people</span>
              <button className="dm-start-btn" onClick={() => {}}>Go to Settings →</button>
            </div>
          )}

          {hasUsername && (
            <>
              {search.length < 2 && (
                <div className="dm-list-empty" style={{ paddingTop: '1.5rem' }}>
                  <span style={{ fontSize: '1.3rem' }}>🔍</span>
                  <span>Type a name or @username to search</span>
                </div>
              )}
              {searching && <div className="dm-list-empty">Searching...</div>}
              {!searching && search.length >= 2 && searchResults.length === 0 && (
                <div className="dm-list-empty">No users found for "<strong>{search}</strong>"</div>
              )}
              {searchResults.map(u => (
                <button key={u.id} className="dm-conv-item" onClick={() => startConversation(u)}>
                  <div className="dm-avatar">
                    {u.avatar_url
                      ? <img src={u.avatar_url} alt="" />
                      : <div className="dm-avatar-placeholder">
                          {u.display_name?.[0]?.toUpperCase() || u.username?.[0]?.toUpperCase() || '?'}
                        </div>}
                  </div>
                  <div className="dm-conv-info">
                    <div className="dm-conv-name">{u.display_name || u.username}</div>
                    <div className="dm-conv-last" style={{ color: 'var(--accent1)' }}>@{u.username}</div>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default ConversationList