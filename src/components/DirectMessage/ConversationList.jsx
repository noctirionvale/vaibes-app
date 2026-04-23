import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

const ConversationList = ({ onSelect, activeId }) => {
  const { user } = useAuth()
  const [conversations, setConversations] = useState([])
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('chats') // chats | people

  // Fetch existing conversations
  useEffect(() => {
    if (!user?.id) return
    const fetchConversations = async () => {
      const { data } = await supabase
        .from('dm_conversations')
        .select(`
          *,
          user1:profiles!dm_conversations_user1_id_fkey(
            id, display_name, avatar_url
          ),
          user2:profiles!dm_conversations_user2_id_fkey(
            id, display_name, avatar_url
          )
        `)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false })

      setConversations(data || [])
    }
    fetchConversations()

    // Realtime subscription
    const sub = supabase
      .channel('dm_conversations')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'dm_conversations'
      }, fetchConversations)
      .subscribe()

    return () => sub.unsubscribe()
  }, [user?.id])

  // Fetch all users for "People" tab
  useEffect(() => {
    if (!user?.id) return
    const fetchUsers = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .neq('id', user.id)
        .limit(50)
      setUsers(data || [])
    }
    fetchUsers()
  }, [user?.id])

  const startConversation = async (otherUser) => {
    // Check if conversation already exists
    const existing = conversations.find(c =>
      (c.user1_id === user.id && c.user2_id === otherUser.id) ||
      (c.user2_id === user.id && c.user1_id === otherUser.id)
    )

    if (existing) {
      onSelect(existing, otherUser)
      setTab('chats')
      return
    }

    // Create new conversation
    const { data } = await supabase
      .from('dm_conversations')
      .insert({
        user1_id: user.id,
        user2_id: otherUser.id
      })
      .select()
      .single()

    if (data) {
      onSelect(data, otherUser)
      setTab('chats')
    }
  }

  const getOtherUser = (conv) => {
    return conv.user1_id === user?.id ? conv.user2 : conv.user1
  }

  const filteredUsers = users.filter(u =>
    u.display_name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="dm-conv-list">
      {/* Tabs */}
      <div className="dm-tabs">
        <button
          className={`dm-tab ${tab === 'chats' ? 'active' : ''}`}
          onClick={() => setTab('chats')}
        >
          Chats
          {conversations.length > 0 && (
            <span className="dm-badge">{conversations.length}</span>
          )}
        </button>
        <button
          className={`dm-tab ${tab === 'people' ? 'active' : ''}`}
          onClick={() => setTab('people')}
        >
          People
        </button>
      </div>

      {/* Search */}
      <div className="dm-search">
        <input
          type="text"
          placeholder={tab === 'chats' ? 'Search chats...' : 'Find people...'}
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
              <button
                onClick={() => setTab('people')}
                className="dm-start-btn"
              >
                Find people →
              </button>
            </div>
          ) : (
            conversations
              .filter(c => {
                const other = getOtherUser(c)
                return other?.display_name
                  ?.toLowerCase()
                  .includes(search.toLowerCase())
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
                          </div>
                      }
                    </div>
                    <div className="dm-conv-info">
                      <div className="dm-conv-name">
                        {other?.display_name || 'User'}
                      </div>
                      <div className="dm-conv-last">
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
          {filteredUsers.map(u => (
            <button
              key={u.id}
              className="dm-conv-item"
              onClick={() => startConversation(u)}
            >
              <div className="dm-avatar">
                {u.avatar_url
                  ? <img src={u.avatar_url} alt="" />
                  : <div className="dm-avatar-placeholder">
                      {u.display_name?.[0]?.toUpperCase() || '?'}
                    </div>
                }
              </div>
              <div className="dm-conv-info">
                <div className="dm-conv-name">
                  {u.display_name || 'User'}
                </div>
                <div className="dm-conv-last">
                  Click to message
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default ConversationList