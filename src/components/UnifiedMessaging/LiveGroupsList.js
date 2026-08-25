// src/components/UnifiedMessaging/LiveGroupsList.js
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const ADMIN_EMAIL = 'noctirionvale@gmail.com';

const LiveGroupsList = ({ onSelectGroup }) => {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('💬');

  const isAdmin = user?.email === ADMIN_EMAIL;

  const channelIdRef = useRef(`groups-live-updates-${Math.random().toString(36).slice(2)}`);

  const fetchGroups = useCallback(async () => {
    setLoading(true);

    const [
      { data: groupsData, error: groupsErr },
      { data: membersData },
      { data: sessionsData },
      { data: participantsData },
    ] = await Promise.all([
      supabase.from('groups').select('id, name, icon, created_by'),
      supabase.from('group_members').select('group_id, user_id'),
      supabase.from('live_sessions').select('id, group_id, ended_at').is('ended_at', null),
      supabase.from('live_participants').select('session_id'),
    ]);

    if (groupsErr) { console.error('Groups fetch error:', groupsErr); setLoading(false); return; }

    const mapped = (groupsData || []).map(g => {
      const memberCount = (membersData || []).filter(m => m.group_id === g.id).length;
      const isMember     = (membersData || []).some(m => m.group_id === g.id && m.user_id === user?.id);
      const liveSession  = (sessionsData || []).find(s => s.group_id === g.id);
      const watching = liveSession
        ? (participantsData || []).filter(p => p.session_id === liveSession.id).length
        : 0;

      return {
        id: g.id,
        name: g.name,
        icon: g.icon,
        createdBy: g.created_by,
        members: memberCount,
        isMember,
        live: !!liveSession,
        liveSessionId: liveSession?.id ?? null,
        watching,
        category: liveSession ? 'live' : 'group',
      };
    });

    setGroups(mapped);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchGroups();

    const channel = supabase
      .channel(channelIdRef.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_sessions' }, fetchGroups)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' }, fetchGroups)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, fetchGroups)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [fetchGroups]);

  const createGroup = async () => {
    if (!newName.trim()) return;
    const { data, error } = await supabase
      .from('groups')
      .insert({ name: newName.trim(), icon: newIcon, created_by: user.id })
      .select()
      .single();

    if (error) { console.error(error); return; }

    await supabase.from('group_members').insert({ group_id: data.id, user_id: user.id });

    setNewName('');
    setNewIcon('💬');
    setShowCreate(false);
    fetchGroups();
  };

  // Ends the live session only — doesn't delete the room. Available to the
  // owner OR admin, so a stuck session is never unrecoverable from the UI
  // again (this is what image 2/3's group needed and had no button for).
  const endLiveSession = async (group, e) => {
    e.stopPropagation();
    if (!group.liveSessionId) return;
    if (!window.confirm(`End the live session in "${group.name}" for everyone?`)) return;

    try {
      await supabase.from('live_participants').delete().eq('session_id', group.liveSessionId);
      const { error } = await supabase
        .from('live_sessions')
        .update({ ended_at: new Date().toISOString(), status: 'ended' })
        .eq('id', group.liveSessionId);
      if (error) throw error;
      fetchGroups();
    } catch (err) {
      console.error('End live session error:', err);
      alert(`Failed to end session: ${err.message}`);
    }
  };

  // Self-service exit for members who are NOT the owner — removes just
  // their own membership row so a group they don't control can never trap
  // them again.
  const leaveGroup = async (group, e) => {
    e.stopPropagation();
    if (!window.confirm(`Leave "${group.name}"?`)) return;
    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .match({ group_id: group.id, user_id: user.id });
      if (error) throw error;
      fetchGroups();
    } catch (err) {
      console.error('Leave group error:', err);
      alert(`Failed to leave: ${err.message}`);
    }
  };

  const deleteGroup = async (group, e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${group.name}"? This removes the room and its chat for everyone.`)) return;

    try {
      if (group.liveSessionId) {
        await supabase.from('live_participants').delete().eq('session_id', group.liveSessionId);
        await supabase.from('live_sessions').update({ ended_at: new Date().toISOString(), status: 'ended' }).eq('id', group.liveSessionId);
      }
      await supabase.from('dm_group_messages').delete().eq('group_id', group.id);
      await supabase.from('group_members').delete().eq('group_id', group.id);

      const { data, error } = await supabase.from('groups').delete().eq('id', group.id).select();
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Nothing was deleted — RLS blocked it (created_by mismatch?). Use the SQL editor to force-delete this one.');
      }
      fetchGroups();
    } catch (err) {
      console.error('Delete group error:', err);
      alert(`Failed to delete room: ${err.message}`);
    }
  };

  const getFiltered = () => {
    if (activeFilter === 'live') return groups.filter(g => g.live);
    if (activeFilter === 'groups') return groups.filter(g => !g.live);
    return groups;
  };

  const liveNow = groups.filter(g => g.live);

  return (
    <div className="um-groups-list">
      {activeFilter !== 'groups' && liveNow.length > 0 && (
        <div className="um-section-lbl">Live now</div>
      )}
      {activeFilter !== 'groups' && liveNow.slice(0, 1).map(g => (
        <div key={g.id} className="um-live-card" onClick={() => onSelectGroup(g)}>
          <div className="um-live-thumb">
            <span className="um-live-pill">LIVE</span>
            <span className="um-live-thumb-icon">📡</span>
          </div>
          <div className="um-live-body">
            <div className="um-live-title">{g.name}</div>
            <div className="um-live-meta">
              <span>{g.members} members</span>
              <span className="um-viewers">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                {g.watching} listening
              </span>
            </div>
          </div>
        </div>
      ))}

      <div className="um-groups-filters">
        <button className={`um-filter-btn ${activeFilter === 'all' ? 'active' : ''}`} onClick={() => setActiveFilter('all')}>All</button>
        <button className={`um-filter-btn ${activeFilter === 'live' ? 'active' : ''}`} onClick={() => setActiveFilter('live')}>
          <span className="live-dot" /> Live
        </button>
        <button className={`um-filter-btn ${activeFilter === 'groups' ? 'active' : ''}`} onClick={() => setActiveFilter('groups')}>Groups</button>
        <button className="um-filter-btn" onClick={() => setShowCreate(true)} style={{ marginLeft: 'auto' }}>+ New</button>
      </div>

      {showCreate && (
        <div className="um-paywall" style={{ margin: '6px 10px' }}>
          <input
            className="um-search-input"
            placeholder="Group name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            style={{ marginBottom: 6 }}
          />
          <input
            className="um-search-input"
            placeholder="Emoji icon (e.g. 🚀)"
            value={newIcon}
            onChange={e => setNewIcon(e.target.value)}
            style={{ marginBottom: 8 }}
          />
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
            <button className="um-upgrade-btn" onClick={createGroup}>Create</button>
            <button className="um-shop-anyway" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="um-groups-items">
        {loading && <div className="um-list-empty"><span>⏳</span><p>Loading groups…</p></div>}
        {!loading && getFiltered()
          .filter(g => !(activeFilter !== 'groups' && g.live && g === liveNow[0]))
          .map(group => {
            const isOwner = group.createdBy === user?.id;
            const canManage = isOwner || isAdmin;
            return (
              <div key={group.id} className="msg-group-row">
                <button className={`um-group-item msg-group-item ${group.live ? 'live' : ''}`} onClick={() => onSelectGroup(group)}>
                  <div className="um-group-icon">{group.icon}</div>
                  <div className="um-group-info">
                    <div className="um-group-name">
                      {group.name}
                      {group.live && <span className="um-live-badge">LIVE</span>}
                    </div>
                    <div className="um-group-members">{group.members} members</div>
                  </div>
                </button>

                {group.live && canManage && (
                  <button className="msg-group-endlive" onClick={(e) => endLiveSession(group, e)} title="End live session">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                    </svg>
                  </button>
                )}

                {canManage && (
                  <button className="msg-group-delete" onClick={(e) => deleteGroup(group, e)} title="Delete room">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      <path d="M10 11v6m4-6v6"/>
                      <path d="M9 6V4h6v2"/>
                    </svg>
                  </button>
                )}

                {!isOwner && !isAdmin && group.isMember && (
                  <button className="msg-group-leave" onClick={(e) => leaveGroup(group, e)} title="Leave room">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                      <polyline points="16 17 21 12 16 7"/>
                      <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
};

export default LiveGroupsList;