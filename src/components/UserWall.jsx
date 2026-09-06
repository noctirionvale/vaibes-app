import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import InlineChatView from './UnifiedMessaging/InlineChatView';
import { createPortal } from 'react-dom';
import './UserWall.css';

const renderMarkdown = (text) => {
  if (!text) return '';
  return text
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2>$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,    '<em>$1</em>')
    .replace(/^---+$/gm,      '<hr/>')
    .replace(/^- (.+)$/gm,    '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\n{2,}/g,       '</p><p>')
    .replace(/^(?!<[hul]|<hr)(.+)$/gm, (m) => m.trim() ? m : '')
    .replace(/^<\/p><p>$/, '')
    .trim();
};

const UserWall = ({ refreshTrigger, onEditItem }) => {
  const { user } = useAuth();
  const [items, setItems]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [filterType, setFilterType]     = useState(null);
  const [expandedIds, setExpandedIds]   = useState(new Set());
  const [modalItem, setModalItem]       = useState(null);
  const [lightbox, setLightbox]         = useState(null);
  const [floatingVideo, setFloatingVideo] = useState(null);
  const [inlineVideo, setInlineVideo]   = useState(new Set());
  const [playerPos, setPlayerPos]       = useState({ x: 40, y: 80 });
  const [isDragging, setIsDragging]     = useState(false);
  const [viewMode, setViewMode]         = useState('grid');
  const dragRef = useRef({ x: 0, y: 0 });

  // Rooms
  const [activeRoom, setActiveRoom]     = useState(null);
  const [roomLoading, setRoomLoading]   = useState(false);
  const [showMyRooms, setShowMyRooms]   = useState(false);
  const [myRooms, setMyRooms]           = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomSearch, setRoomSearch]     = useState('');

  // Join requests
  const [joinRequests, setJoinRequests] = useState([]);
  const [showRequests, setShowRequests] = useState(false);

  // Notifications
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  /* ── Fetch items ── */
  const fetchItems = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [{ data: owned, error: ownedErr }, { data: saves }] = await Promise.all([
      supabase.from('user_creatives').select('*').eq('user_id', user.id)
        .order('is_pinned', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('user_saves').select('item_id').eq('user_id', user.id).eq('content_type', 'wall'),
    ]);
    if (ownedErr) { setLoading(false); return; }

    const savedIds = (saves || []).map(s => s.item_id);
    const { data: savedItems } = savedIds.length
      ? await supabase.from('user_creatives').select('*').in('id', savedIds)
      : { data: [] };

    setItems([...(owned || []), ...(savedItems || []).map(i => ({ ...i, is_saved_reference: true }))]);
    setLoading(false);
  }, [user]);

  useEffect(() => { if (user) fetchItems(); }, [user, fetchItems, refreshTrigger]);

  /* ── Fetch Notifications ── */
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('notifications').select('*')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(30);
    setNotifications(data || []);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    const channel = supabase.channel(`notifications-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}`
      }, payload => setNotifications(prev => [payload.new, ...prev]))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchNotifications]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const openNotifications = async () => {
    setShowNotifications(true);
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length) {
      await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
      setNotifications(prev => prev.map(n => unreadIds.includes(n.id) ? { ...n, is_read: true } : n));
    }
  };

  /* ── My rooms ── */
  const fetchMyRooms = useCallback(async () => {
    if (!user) return;
    setRoomsLoading(true);
    try {
      const { data: memberRows, error: memberErr } = await supabase
        .from('group_members').select('group_id').eq('user_id', user.id);
      if (memberErr) throw memberErr;
      const groupIds = (memberRows || []).map(r => r.group_id);
      if (groupIds.length === 0) { setMyRooms([]); setRoomsLoading(false); return; }

      const { data: groupsData, error: groupsErr } = await supabase
        .from('groups').select('*').in('id', groupIds);
      if (groupsErr) throw groupsErr;

      const creatorIds = [...new Set((groupsData || []).map(g => g.created_by).filter(Boolean))];
      let creatorsById = {};
      if (creatorIds.length > 0) {
        const { data: creators } = await supabase
          .from('profiles').select('id, display_name, username, avatar_url').in('id', creatorIds);
        creatorsById = Object.fromEntries((creators || []).map(c => [c.id, c]));
      }

      setMyRooms((groupsData || []).map(g => ({ ...g, creator: creatorsById[g.created_by] || null })));
    } catch (err) {
      console.error('Failed to load rooms:', err);
    } finally {
      setRoomsLoading(false);
    }
  }, [user]);

  /* ── Join requests ── */
  const fetchJoinRequests = async () => {
    if (!user) return;
    const { data: myGroups } = await supabase
      .from('groups').select('id').eq('created_by', user.id);

    if (!myGroups || myGroups.length === 0) {
      setJoinRequests([]);
      return;
    }

    const groupIds = myGroups.map(g => g.id);
    const { data: requests } = await supabase
      .from('join_requests')
      .select(`*, groups!inner(id, name, wall_item_id), user_creatives!inner(id, title)`)
      .in('group_id', groupIds)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    setJoinRequests(requests || []);
  };

  const approveRequest = async (requestId, requesterEmail) => {
    const { error } = await supabase.rpc('approve_join_request', {
      request_id: requestId,
      approver_id: user.id
    });
    if (!error) {
      setJoinRequests(prev => prev.filter(r => r.id !== requestId));
      alert(`✅ Approved! ${requesterEmail} has been added to the room.`);
    } else {
      alert('Failed to approve: ' + error.message);
    }
  };

  const rejectRequest = async (requestId) => {
    const { error } = await supabase
      .from('join_requests')
      .update({ status: 'rejected' })
      .eq('id', requestId);
    if (!error) setJoinRequests(prev => prev.filter(r => r.id !== requestId));
  };

  /* ── Drag ── */
  const startDrag = (e) => {
    e.preventDefault(); setIsDragging(true);
    const cx = e.clientX ?? e.touches?.[0]?.clientX;
    const cy = e.clientY ?? e.touches?.[0]?.clientY;
    dragRef.current = { x: cx - playerPos.x, y: cy - playerPos.y };
  };
  const onDragMove = useCallback((e) => {
    if (!isDragging) return;
    const cx = e.clientX ?? e.touches?.[0]?.clientX;
    const cy = e.clientY ?? e.touches?.[0]?.clientY;
    setPlayerPos({ x: cx - dragRef.current.x, y: cy - dragRef.current.y });
  }, [isDragging]);
  const stopDrag = useCallback(() => setIsDragging(false), []);
  useEffect(() => {
    if (!isDragging) return;
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', stopDrag);
    window.addEventListener('touchmove', onDragMove);
    window.addEventListener('touchend', stopDrag);
    return () => {
      window.removeEventListener('mousemove', onDragMove);
      window.removeEventListener('mouseup', stopDrag);
      window.removeEventListener('touchmove', onDragMove);
      window.removeEventListener('touchend', stopDrag);
    };
  }, [isDragging, onDragMove, stopDrag]);

  /* ── Helpers ── */
  const extractYouTubeId = (url) => {
    if (!url) return null;
    const m = url.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
    return m && m[2]?.length === 11 ? m[2] : null;
  };

  const stripHtml = (html) => {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').trim();
  };

  const renderContent = (content) => {
    if (!content) return '';
    const stripped = stripHtml(content);
    if (content.trim().startsWith('<') && stripped.length < content.length * 0.9) return content;
    return `<p>${renderMarkdown(content)}</p>`;
  };

  const getCardType = (item) => {
    if (item.media_type === 'video' || item.attachments?.some(a => a.type?.startsWith('video/'))) return 'video';
    if (item.media_type === 'youtube' || item.attachments?.some(a => a.type === 'youtube') || extractYouTubeId(item.content)) return 'youtube';
    if (item.attachments?.some(a => a.type?.startsWith('image/'))) return 'image';
    return 'note';
  };

  const typeEmoji = (item) => {
    const type = getCardType(item);
    return type === 'note' ? '📝' : type === 'video' ? '🎬' : type === 'youtube' ? '▶️' : '🖼️';
  };

  const startRoom = async (item) => {
  setRoomLoading(true);
  try {
    const { data: existing, error: findErr } = await supabase
      .from('groups').select('*').eq('wall_item_id', item.id).maybeSingle();
    if (findErr) throw findErr;

    let group = existing;
    if (!group) {
      const { data: created, error: createErr } = await supabase
        .from('groups')
        .insert({ name: item.title, icon: typeEmoji(item), created_by: user.id, wall_item_id: item.id })
        .select().single();
      if (createErr) throw createErr;
      group = created;
      await supabase.from('group_members').insert({ group_id: group.id, user_id: user.id });
    }
    closeModal();       // NEW
    setActiveRoom(group);
  } catch (err) {
    console.error('Failed to open study room:', err);
    alert('Could not open the room: ' + (err.message || 'Unknown error'));
  } finally {
    setRoomLoading(false);
  }
};

  const filteredRooms = myRooms.filter(g => {
    const q = roomSearch.trim().toLowerCase();
    if (!q) return true;
    return g.name?.toLowerCase().includes(q)
      || g.creator?.username?.toLowerCase().includes(q)
      || g.creator?.display_name?.toLowerCase().includes(q);
  });

  const toggleExpand = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openInline  = (id) => setInlineVideo(prev => new Set(prev).add(id));
  const closeInline = (id) => setInlineVideo(prev => { const n = new Set(prev); n.delete(id); return n; });
  const openModal   = (item) => setModalItem(item);
  const closeModal  = () => setModalItem(null);

  const handleEdit = (item) => {
    if (onEditItem) onEditItem(item);
    closeModal();
  };

  /* ── Share (Twitter-optimized) ── */
  const shareItem = async (item) => {
    if (!item.is_public) {
      const { error } = await supabase
        .from('user_creatives')
        .update({ is_public: true })
        .eq('id', item.id);
      if (error) { alert('Failed to make content public: ' + error.message); return; }
    }

    const shareUrl  = `${window.location.origin}/share/${item.id}`;
    const plainText = stripHtml(item.content);
    const teaser = plainText.length > 200
      ? plainText.substring(0, 200).trim() + '…'
      : plainText;
    const shareText = `📖 ${item.title}\n\n${teaser}\n\nRead the full story →`;

    if (navigator.share) {
      try { await navigator.share({ title: item.title, text: shareText, url: shareUrl }); return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }

    try {
      await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
      alert('✅ Link copied! Paste it anywhere to share.');
    } catch {
      alert(`Share this link:\n${shareText}\n\n${shareUrl}`);
    }
  };

  const togglePin = async (item) => {
    await supabase.from('user_creatives').update({ is_pinned: !item.is_pinned }).eq('id', item.id);
    fetchItems();
  };

  const requestJoinRoom = async (item) => {
    const { data: group } = await supabase.from('groups').select('id, name').eq('wall_item_id', item.id).maybeSingle();
    if (!group) { alert('No study room exists for this content yet.'); return; }
    const { error } = await supabase.from('join_requests').insert({
      group_id: group.id, item_id: item.id,
      requester_email: user.email,
      requester_name: user.user_metadata?.display_name || user.email,
    });
    alert(error ? 'Failed to send request: ' + error.message : '✅ Request sent — the room owner will review it.');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this item permanently?')) return;
    await supabase.from('user_creatives').delete().eq('id', id);
    if (modalItem?.id === id) closeModal();
    fetchItems();
  };

  const filtered = filterType ? items.filter(i => getCardType(i) === filterType) : items;

  /* ── Card renderer ── */
  const renderCard = (item) => {
    const type       = getCardType(item);
    const isExpanded = expandedIds.has(item.id);
    const isInline   = inlineVideo.has(item.id);
    const isSpectator = !!item.is_saved_reference;

    const ytAttachment = item.attachments?.find(a => a.type === 'youtube');
    const ytId = type === 'youtube'
      ? (extractYouTubeId(item.content) || (ytAttachment ? extractYouTubeId(ytAttachment.url) : null))
      : null;

    const videoAtt  = item.attachments?.find(a => a.type?.startsWith('video/'));
    const imageAtts = item.attachments?.filter(a => a.type?.startsWith('image/')) || [];
    const fileAtts  = item.attachments?.filter(
      a => !a.type?.startsWith('image/') && !a.type?.startsWith('video/') && a.type !== 'youtube'
    ) || [];

    const hasMedia  = type === 'image' || type === 'video' || type === 'youtube';
    const plainText = stripHtml(item.content);
    const isJustUrl = type === 'youtube' && extractYouTubeId(item.content);
    const hasText   = plainText.length > 0 && !isJustUrl;
    const longText  = plainText.length > 200;
    const imgClass  = imageAtts.length === 1 ? 'single' : imageAtts.length === 2 ? 'double' : 'multi';

    return (
      <div
        key={item.id}
        className={`wall-card ${viewMode === 'grid' ? 'grid-card' : 'list-card'} ${item.is_pinned ? 'pinned' : ''} ${isExpanded ? 'card-expanded' : ''} ${isSpectator ? 'spectator' : ''}`}
      >
        <div className={`card-media-wrap ${hasMedia ? 'has-media' : ''}`}>
          {type === 'youtube' && ytId && (
            <div className="media-youtube">
              {isInline ? (
                <div className="media-youtube-embed">
                  <iframe src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0`}
                    title={item.title} frameBorder="0" allowFullScreen allow="autoplay; encrypted-media" />
                  <div className="media-youtube-controls">
                    <button className="yt-float-btn" onClick={() => { setFloatingVideo({ videoId: ytId, title: item.title }); closeInline(item.id); }}>⤢ Float</button>
                    <button className="yt-close-btn" onClick={() => closeInline(item.id)}>✕</button>
                  </div>
                </div>
              ) : (
                <div onClick={() => openInline(item.id)} style={{ width:'100%', height:'100%' }}>
                  <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} alt={item.title} />
                  <div className="play-overlay"><div className="play-overlay-inner">▶</div></div>
                </div>
              )}
            </div>
          )}

          {type === 'video' && videoAtt && (
            <div className="media-video-container">
              <video src={videoAtt.url} controls className="media-video" onClick={e => e.stopPropagation()} />
            </div>
          )}

          {type === 'image' && imageAtts.length > 0 && (
            <div className={`media-images ${imgClass}`}>
              {imageAtts.slice(0, 4).map((img, i) => (
                <img key={i} src={img.url} alt={img.name}
                  onClick={e => { e.stopPropagation(); setLightbox(img.url); }} />
              ))}
              {imageAtts.length > 4 && <div className="image-more">+{imageAtts.length - 4}</div>}
            </div>
          )}
        </div>

        <div className="card-content">
          <div className="card-header">
            <div className="card-title-wrap" onClick={() => openModal(item)} title="Open full view">
              {item.is_pinned && <span className="pin-icon">📌</span>}
              {isSpectator && <span className="spectator-badge">👁️ Read-only</span>}
              <span className="card-type-icon">
                {type === 'note' ? '📝' : type === 'video' ? '🎬' : type === 'youtube' ? '▶️' : '🖼️'}
              </span>
              <h4 className="card-title">{item.title}</h4>
            </div>
          </div>

          {hasText && (
            <div className="card-text">
              <div className={`text-content ${isExpanded ? 'text-expanded' : 'collapsed'}`}
                dangerouslySetInnerHTML={{ __html: item.content }} />
              {longText && (
                <button className="expand-btn" onClick={() => toggleExpand(item.id)}>
                  {isExpanded ? '↑ Show less' : '↓ Show more'}
                </button>
              )}
            </div>
          )}

          {!hasText && type === 'image' && (
            <button className="expand-btn" style={{ marginTop: '0.5rem' }}
              onClick={() => toggleExpand(item.id)}>
              {isExpanded ? '↑ Collapse' : '↓ Full image'}
            </button>
          )}

          {fileAtts.length > 0 && (
            <div className="attachments">
              {fileAtts.map((f, i) => (
                <a key={i} href={f.url} target="_blank" rel="noopener noreferrer"
                  className="attachment-link">📎 {f.name}</a>
              ))}
            </div>
          )}

          <div className="card-actions">
            <button onClick={() => openModal(item)} className="action-btn share">↗ Open</button>

            {!isSpectator && (
              <>
                <button onClick={() => startRoom(item)} className="action-btn share">💬 Study</button>
                <button onClick={() => handleEdit(item)}      className="action-btn edit">✏️ Edit</button>
                <button onClick={() => shareItem(item)}       className="action-btn share">🔗 Share</button>
                <button onClick={() => togglePin(item)}       className="action-btn pin">
                  {item.is_pinned ? '📌' : '📍'}
                </button>
                <button onClick={() => handleDelete(item.id)} className="action-btn delete">🗑️</button>
              </>
            )}

            {isSpectator && (
              <>
                <button onClick={() => shareItem(item)} className="action-btn share">🔗 Share</button>
                <button onClick={() => requestJoinRoom(item)} className="action-btn share">👥 Join Room</button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  /* ── Item modal ── */
  const renderModal = () => {
    if (!modalItem) return null;
    const item      = modalItem;
    const type      = getCardType(item);
    const ytAttachment = item.attachments?.find(a => a.type === 'youtube');
    const ytId = type === 'youtube'
      ? (extractYouTubeId(item.content) || (ytAttachment ? extractYouTubeId(ytAttachment.url) : null))
      : null;
    const videoAtt  = item.attachments?.find(a => a.type?.startsWith('video/'));
    const imageAtts = item.attachments?.filter(a => a.type?.startsWith('image/')) || [];
    const fileAtts  = item.attachments?.filter(
      a => !a.type?.startsWith('image/') && !a.type?.startsWith('video/') && a.type !== 'youtube'
    ) || [];
    const imgClass     = imageAtts.length === 1 ? 'single' : imageAtts.length === 2 ? 'double' : 'multi';
    const isJustUrl    = type === 'youtube' && extractYouTubeId(item.content);
    const plainText    = stripHtml(item.content);
    const hasModalText = plainText.length > 0 && !isJustUrl;
    const renderedContent = renderContent(item.content);

    return createPortal(
      <div className="creation-modal-overlay" onClick={closeModal}>
        <div className="creation-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-close">
            <button className="modal-close-btn" onClick={closeModal}>✕</button>
          </div>

          {type === 'youtube' && ytId && (
            <div className="modal-yt-area">
              <iframe src={`https://www.youtube-nocookie.com/embed/${ytId}?rel=0`}
                title={item.title} allowFullScreen />
            </div>
          )}
          {type === 'video' && videoAtt && (
            <div className="modal-video-area"><video src={videoAtt.url} controls /></div>
          )}
          {type === 'image' && imageAtts.length > 0 && (
            <div className="modal-image-area">
              <div className={`modal-image-grid ${imgClass}`}>
                {imageAtts.map((img, i) => (
                  <img key={i} src={img.url} alt={img.name}
                    onClick={() => setLightbox(img.url)} />
                ))}
              </div>
            </div>
          )}

          <div className="modal-body">
            <h2 className="modal-title">{item.title}</h2>

            {hasModalText && (
              <div className="modal-content"
                dangerouslySetInnerHTML={{ __html: renderedContent }} />
            )}

            {fileAtts.length > 0 && (
              <div className="attachments" style={{ marginTop: '1rem' }}>
                {fileAtts.map((f, i) => (
                  <a key={i} href={f.url} target="_blank" rel="noopener noreferrer"
                    className="attachment-link">📎 {f.name}</a>
                ))}
              </div>
            )}

            <div className="modal-actions">
              <button onClick={() => handleEdit(item)}      className="modal-action-btn">✏️ Edit</button>
              <button onClick={() => startRoom(item)}       className="modal-action-btn" disabled={roomLoading}>💬 Study Room</button>
              <button onClick={() => shareItem(item)}       className="modal-action-btn">🔗 Share</button>
              <button onClick={() => togglePin(item)}       className="modal-action-btn">
                {item.is_pinned ? '📌 Unpin' : '📍 Pin'}
              </button>
              <button onClick={() => handleDelete(item.id)} className="modal-action-btn danger">🗑️ Delete</button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  const renderActiveRoom = () => {
    if (!activeRoom) return null;
    return createPortal(
      <div className="room-overlay">
        <InlineChatView type="group" group={activeRoom} onBack={() => setActiveRoom(null)} />
      </div>,
      document.body
    );
  };

  const renderMyRoomsModal = () => {
    if (!showMyRooms) return null;
    return createPortal(
      <div className="creation-modal-overlay" onClick={() => setShowMyRooms(false)}>
        <div className="room-picker-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
          <div className="modal-close">
            <button className="modal-close-btn" onClick={() => setShowMyRooms(false)}>✕</button>
          </div>
          <h3 className="room-picker-title">My Rooms</h3>
          <p className="room-picker-sub">Rooms you've been added to.</p>
          <div className="um-search-wrap" style={{ marginBottom: 10 }}>
            <input type="text" className="um-search-input" placeholder="Search by room or username…"
              value={roomSearch} onChange={e => setRoomSearch(e.target.value)} />
          </div>
          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            {roomsLoading && <div className="um-list-empty"><p>Loading…</p></div>}
            {!roomsLoading && filteredRooms.length === 0 && (
              <div className="um-list-empty"><span>🚪</span><p>No rooms yet</p></div>
            )}
            {!roomsLoading && filteredRooms.map(g => (
              <button key={g.id} className="um-conv-item"
                onClick={() => { setActiveRoom(g); setShowMyRooms(false); }}>
                <div className="um-conv-avatar">
                  <div className="um-avatar-placeholder">{g.icon || '💬'}</div>
                </div>
                <div className="um-conv-info">
                  <div className="um-conv-name">{g.name}</div>
                  <div className="um-conv-preview">
                    {g.creator ? `by ${g.creator.display_name || g.creator.username}` : ''}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  /* ── Join requests modal ── */
  const renderJoinRequestsModal = () => {
    if (!showRequests) return null;
    return createPortal(
      <div className="creation-modal-overlay" onClick={() => setShowRequests(false)}>
        <div className="creation-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-close">
            <button className="modal-close-btn" onClick={() => setShowRequests(false)}>✕</button>
          </div>
          <div className="modal-body">
            <h2 className="modal-title">Join Requests ({joinRequests.length})</h2>
            {joinRequests.length === 0 && (
              <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '2rem' }}>No pending requests.</p>
            )}
            {joinRequests.map(req => (
              <div key={req.id} className="join-request-card" style={{
                padding: '1rem', marginBottom: '0.75rem',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px'
              }}>
                <div style={{ marginBottom: '0.75rem' }}>
                  <strong style={{ display: 'block', fontSize: '0.9rem' }}>{req.requester_name}</strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{req.requester_email}</span>
                  <div style={{ fontSize: '0.75rem', color: '#a78bfa', marginTop: '0.35rem' }}>
                    For: {req.groups?.name || 'Study Room'}
                  </div>
                  {req.message && <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>{req.message}</p>}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="modal-action-btn" onClick={() => approveRequest(req.id, req.requester_email)}>
                    ✓ Approve
                  </button>
                  <button className="modal-action-btn danger" onClick={() => rejectRequest(req.id)}>
                    ✕ Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (loading) return <div className="wall-loading">✨ Loading your creative wall...</div>;

  return (
    <div className="user-wall">
      <div className="wall-header">
        <div className="wall-header-top">
          <div className="header-left">
            <h2>🎨 Creative Gallery</h2>
            <span className="item-count">{items.length} item{items.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="header-right">
            <div className="notif-bell-wrap">
              <button className="notif-bell-btn" onClick={openNotifications} title="Notifications">
                🔔
                {unreadCount > 0 && <span className="notif-bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
              </button>
              {showNotifications && (
                <>
                  <div className="notif-dropdown-backdrop" onClick={() => setShowNotifications(false)} />
                  <div className="notif-dropdown">
                    <div className="notif-dropdown-header">
                      <span>Notifications</span>
                      <button className="modal-close-btn" onClick={() => setShowNotifications(false)}>✕</button>
                    </div>
                    <div className="notif-dropdown-list">
                      {notifications.length === 0 && (
                        <div className="um-list-empty"><span>🔔</span><p>No notifications yet</p></div>
                      )}
                      {notifications.map(n => (
                        <div
                          key={n.id}
                          className={`notif-item ${n.is_read ? '' : 'unread'}`}
                          style={n.type === 'join_request' ? { cursor: 'pointer' } : undefined}
                          onClick={() => {
                            if (n.type !== 'join_request') return;
                            setShowNotifications(false);
                            setShowRequests(true);
                            fetchJoinRequests();
                          }}
                        >
                          <div className="notif-item-title">{n.title}</div>
                          {n.body && <div className="notif-item-body">{n.body}</div>}
                          <div className="notif-item-time">{new Date(n.created_at).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="view-toggle">
              <button className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}>⊞ Grid</button>
              <button className={`view-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>≡ List</button>
            </div>
          </div>
        </div>

        <div className="wall-header-controls">
          <div className="control-group">
            {joinRequests.length > 0 && (
              <button className="filter-chip" onClick={() => { setShowRequests(true); fetchJoinRequests(); }}>
                📨 Requests ({joinRequests.length})
              </button>
            )}
            <button className="filter-chip" onClick={() => { setShowMyRooms(true); fetchMyRooms(); }}>
              🚪 My Rooms
            </button>
          </div>

          <span className="control-divider" />

          <div className="control-group">
            <button className={`filter-chip ${!filterType ? 'active' : ''}`} onClick={() => setFilterType(null)}>All</button>
            {['note','image','video','youtube'].map(t => (
              <button key={t} className={`filter-chip ${filterType === t ? 'active' : ''}`}
                onClick={() => setFilterType(prev => prev === t ? null : t)}>
                {t === 'note' ? '📝 Note' : t === 'image' ? '🖼️ Image' : t === 'video' ? '🎬 Video' : '▶️ YouTube'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={`wall-grid ${viewMode === 'grid' ? 'grid-view' : 'list-view'}`}>
        {filtered.length === 0 && (
          <div className="empty-wall">
            <span className="empty-icon">🎨</span>
            <p>Your gallery is empty</p>
            <span>Create something in the Creative Workspace ✏️</span>
          </div>
        )}
        {filtered.map(renderCard)}
      </div>

      {renderModal()}
      {renderActiveRoom()}
      {renderMyRoomsModal()}
      {renderJoinRequestsModal()}

      {floatingVideo && (
        <div className="floating-player" style={{ left: playerPos.x, top: playerPos.y }}>
          <div className="player-bar" onMouseDown={startDrag} onTouchStart={startDrag}>
            <span>{floatingVideo.title}</span>
            <button onClick={() => setFloatingVideo(null)}>✕</button>
          </div>
          <iframe src={`https://www.youtube-nocookie.com/embed/${floatingVideo.videoId}?autoplay=1&rel=0`}
            title={floatingVideo.title} frameBorder="0" allowFullScreen />
        </div>
      )}

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Full size" />
          <button className="lightbox-close" onClick={() => setLightbox(null)}>✕</button>
        </div>
      )}
    </div>
  );
};

export default UserWall;