import React, { useState, useEffect, useRef } from 'react'
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

  // Check if current user has username set
  useEffect(() => {
    if (!user?.id) return
    supabase.from('profiles').select('username')
      .eq('id', user.id).maybeSingle()
      .then(({ data }) => setHasUsername(!!data?.username))
  }, [user?.id])

  // Fetch conversations
  useEffect(() => {
    if (!user?.id) return
    const fetchConversations = async () => {
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
      setConversations(data || [])
    }
    fetchConversations()

    const sub = supabase.channel('dm_convos')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'dm_conversations'
      }, fetchConversations)
      .subscribe()
    return () => sub.unsubscribe()
  }, [user?.id])

  // Search users by username (debounced)
  useEffect(() => {
    if (tab !== 'people') return
    clearTimeout(searchTimer.current)
    if (!search.trim() || search.length < 2) {
      setSearchResults([])
      return
    }
    setSearching(true)
    searchTimer.current = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .eq('is_searchable', true)
        .ilike('username', `%${search.replace('@','')}%`)
        .neq('id', user.id)
        .limit(20)
      setSearchResults(data || [])
      setSearching(false)
    }, 350)
  }, [search, tab, user?.id])

  const startConversation = async (otherUser) => {
    const existing = conversations.find(c =>
      (c.user1_id === user.id && c.user2_id === otherUser.id) ||
      (c.user2_id === user.id && c.user1_id === otherUser.id)
    )
    if (existing) { onSelect(existing, otherUser); setTab('chats'); return }

    const { data } = await supabase
      .from('dm_conversations')
      .insert({ user1_id: user.id, user2_id: otherUser.id })
      .select().single()
    if (data) { onSelect(data, otherUser); setTab('chats') }
  }

  const getOtherUser = (conv) =>
    conv.user1_id === user?.id ? conv.user2 : conv.user1

  return (
    <div className="dm-conv-list">
      <div className="dm-tabs">
        <button className={`dm-tab ${tab === 'chats' ? 'active' : ''}`} onClick={() => setTab('chats')}>
          Chats
          {conversations.length > 0 && <span className="dm-badge">{conversations.length}</span>}
        </button>
        <button className={`dm-tab ${tab === 'people' ? 'active' : ''}`} onClick={() => setTab('people')}>
          People
        </button>
      </div>

      <div className="dm-search">
        <input
          type="text"
          placeholder={tab === 'chats' ? 'Search chats...' : 'Search @username...'}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="dm-search-input"
        />
      </div>

      {/* Chats Tab */}
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
                return other?.display_name?.toLowerCase().includes(search.toLowerCase())
                  || other?.username?.toLowerCase().includes(search.toLowerCase())
              })
              .map(conv => {
                const other = getOtherUser(conv)
                return (
                  <button key={conv.id}
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
                        {other?.username && <span style={{color:'var(--accent2)', marginRight:'0.25rem'}}>@{other.username}</span>}
                        {conv.last_message || 'Start a conversation'}
                      </div>
                    </div>
                  </button>
                )
              })
          )}
        </div>
      )}

      {/* People Tab */}
      {tab === 'people' && (
        <div className="dm-list">
          {/* Username gate */}
          {!hasUsername && (
            <div className="dm-list-empty">
              <span style={{fontSize:'1.5rem'}}>🔒</span>
              <span>Set a username in your profile to find and message people</span>
              <button className="dm-start-btn" onClick={() => {}}>
                Go to Settings →
              </button>
            </div>
          )}

          {hasUsername && (
            <>
              {search.length < 2 && (
                <div className="dm-list-empty" style={{paddingTop:'1.5rem'}}>
                  <span style={{fontSize:'1.3rem'}}>🔍</span>
                  <span>Type a @username to search</span>
                </div>
              )}
              {searching && (
                <div className="dm-list-empty">Searching...</div>
              )}
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
                    <div className="dm-conv-last" style={{color:'var(--accent2)'}}>@{u.username}</div>
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