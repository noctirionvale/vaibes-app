// src/components/UnifiedMessaging/ConversationList.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const formatRelativeTime = (iso) => {
  if (!iso) return '';
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  const hr = Math.floor(diffMin / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const ConversationList = ({ onSelect, onOpenBilling, instanceId = 'default' }) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [search, setSearch]               = useState('');
  const [tab, setTab]                     = useState('chats');
  const [searching, setSearching]         = useState(false);
  const [hasUsername] = useState(true);
  const searchTimer      = useRef(null);
  const conversationsRef = useRef(conversations);

  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);

  const fetchConversations = useCallback(async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from('dm_conversations')
      .select(`
        *,
        user1:profiles!dm_conversations_user1_profile_fkey(id, display_name, username, avatar_url),
        user2:profiles!dm_conversations_user2_profile_fkey(id, display_name, username, avatar_url)
      `)
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .order('last_message_at', { ascending: false });
    if (error) { console.error('Fetch conversations error:', error); return; }
    // Hide threads the current user deleted from their own list (columns default false, safe pre-migration too)
    const visible = (data || []).filter(c => {
      const hidden = c.user1_id === user.id ? c.hidden_by_user1 : c.hidden_by_user2;
      return !hidden;
    });
    setConversations(visible);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    fetchConversations();
    const channel = supabase
      .channel(`dm_conversations_${user.id}_${instanceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_conversations', filter: `user1_id=eq.${user.id}` }, () => fetchConversations())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_conversations', filter: `user2_id=eq.${user.id}` }, () => fetchConversations())
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') console.log('✅ Subscribed to dm_conversations channel');
      });
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, fetchConversations, instanceId]);

  useEffect(() => {
    if (tab !== 'people') return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!search.trim() || search.length < 2) { setSearchResults([]); setSearching(false); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      const q = search.replace('@', '').trim();
      const { data } = await supabase
        .from('profiles').select('id, display_name, username, avatar_url')
        .eq('is_searchable', true)
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .neq('id', user.id).limit(20);
      setSearchResults(data || []);
      setSearching(false);
    }, 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search, tab, user?.id]);

  const startConversation = async (otherUser) => {
    const existing = conversationsRef.current.find(c =>
      (c.user1_id === user.id && c.user2_id === otherUser.id) ||
      (c.user2_id === user.id && c.user1_id === otherUser.id)
    );
    if (existing) { onSelect(existing, otherUser); setTab('chats'); return; }
    const { data, error } = await supabase
      .from('dm_conversations').insert({ user1_id: user.id, user2_id: otherUser.id }).select().single();
    if (error) { console.error('Error starting conversation:', error); return; }
    if (data) { onSelect(data, otherUser); setTab('chats'); }
  };

  const handleDeleteConversation = async (e, conv) => {
    e.stopPropagation();
    if (!window.confirm('Delete this conversation? It stays removed from your list until a new message arrives.')) return;
    const isUser1 = conv.user1_id === user.id;
    const snapshot = conversations;
    setConversations(prev => prev.filter(c => c.id !== conv.id)); // optimistic
    const { error } = await supabase
      .from('dm_conversations')
      .update(isUser1 ? { hidden_by_user1: true } : { hidden_by_user2: true })
      .eq('id', conv.id);
    if (error) {
      console.error('Delete conversation failed:', error.message);
      setConversations(snapshot); // roll back
    }
  };

  const getOtherUser = (conv) => conv.user1_id === user?.id ? conv.user2 : conv.user1;
  const filtered = conversations.filter(c => {
    const other = getOtherUser(c);
    const t = search.toLowerCase();
    return other?.display_name?.toLowerCase().includes(t) || other?.username?.toLowerCase().includes(t);
  });

  return (
    <div className="um-conv-list">
      <div className="um-list-tabs">
        <button className={`um-list-tab ${tab === 'chats'  ? 'active' : ''}`} onClick={() => setTab('chats')}>Chats</button>
        <button className={`um-list-tab ${tab === 'people' ? 'active' : ''}`} onClick={() => setTab('people')}>People</button>
      </div>

      <div className="um-list-search">
        <div className="um-search-wrap">
          <svg className="um-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text" className="um-search-input"
            placeholder={tab === 'chats' ? 'Search chats…' : 'Search name or @username…'}
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {tab === 'chats' && (
        <div className="um-list-items">
          {filtered.length === 0 && conversations.length === 0 ? (
            <div className="um-list-empty">
              <span>💬</span><p>No conversations yet</p>
              <button onClick={() => setTab('people')} className="um-list-action">Find people →</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="um-list-empty"><p>No results for "{search}"</p></div>
          ) : (
            filtered.map(conv => {
              const other = getOtherUser(conv);
              return (
                <div
                  key={conv.id}
                  className="um-conv-item"
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(conv, other)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(conv, other); } }}
                >
                  <div className="um-conv-avatar">
                    {other?.avatar_url
                      ? <img src={other.avatar_url} alt="" />
                      : <div className="um-avatar-placeholder">{other?.display_name?.[0]?.toUpperCase() || '?'}</div>}
                  </div>
                  <div className="um-conv-info">
                    <div className="um-conv-toprow">
                      <span className="um-conv-name">{other?.display_name || other?.username}</span>
                      <span className="um-conv-time">{formatRelativeTime(conv.last_message_at)}</span>
                    </div>
                    <div className="um-conv-preview">{conv.last_message || 'Start a conversation'}</div>
                  </div>
                  <button
                    type="button"
                    className="um-conv-delete"
                    title="Delete conversation"
                    aria-label="Delete conversation"
                    onClick={(e) => handleDeleteConversation(e, conv)}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      <path d="M10 11v6m4-6v6"/>
                      <path d="M9 6V4h6v2"/>
                    </svg>
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === 'people' && (
        <div className="um-list-items">
          {!hasUsername && <div className="um-list-empty"><span>🔒</span><p>Set a username in Settings to find people</p></div>}
          {hasUsername && search.length < 2 && <div className="um-list-empty"><span>🔍</span><p>Type a name or @username to search</p></div>}
          {searching && <div className="um-list-empty"><p>Searching…</p></div>}
          {!searching && search.length >= 2 && searchResults.length === 0 && <div className="um-list-empty"><p>No users found for "{search}"</p></div>}
          {searchResults.map(u => (
            <button key={u.id} className="um-conv-item" onClick={() => startConversation(u)}>
              <div className="um-conv-avatar">
                {u.avatar_url
                  ? <img src={u.avatar_url} alt="" />
                  : <div className="um-avatar-placeholder">{u.display_name?.[0]?.toUpperCase() || u.username?.[0]?.toUpperCase() || '?'}</div>}
              </div>
              <div className="um-conv-info">
                <div className="um-conv-name">{u.display_name || u.username}</div>
                <div className="um-conv-preview" style={{ color: '#a78bfa' }}>@{u.username}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ConversationList;