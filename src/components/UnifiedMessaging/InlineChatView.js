// src/components/UnifiedMessaging/InlineChatView.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import LiveAudioPanel from './LiveAudioPanel';

/* Live audio is mid-build — flip this when LiveAudioPanel is ready.
   While off, the header shows a "soon" pill instead of mounting the panel. */
const LIVE_AUDIO_ENABLED = false;

const ACCENT_PRESETS = [
  { id: 'default', label: 'Default', value: null },
  { id: 'purple',  label: 'Purple',  value: '#a78bfa' },
  { id: 'blue',    label: 'Blue',    value: '#3b82f6' },
  { id: 'green',   label: 'Green',   value: '#22c55e' },
  { id: 'pink',    label: 'Pink',    value: '#f472b6' },
  { id: 'amber',   label: 'Amber',   value: '#f59e0b' },
];
const FONT_PRESETS = [
  { id: 'default', label: 'Default', value: null },
  { id: 'serif',   label: 'Serif',   value: 'Georgia, "Times New Roman", serif' },
  { id: 'mono',    label: 'Mono',    value: '"SF Mono", "Fira Code", Consolas, monospace' },
  { id: 'rounded', label: 'Rounded', value: '"Quicksand", Nunito, sans-serif' },
];
const BG_PRESETS = [
  { id: 'default', label: 'Default', value: null },
  { id: 'slate',   label: 'Slate',   value: 'linear-gradient(180deg,#1a1a24,#12121a)' },
  { id: 'warm',    label: 'Warm',    value: 'linear-gradient(180deg,#241a1f,#1a1317)' },
  { id: 'ocean',   label: 'Ocean',   value: 'linear-gradient(180deg,#0f1a24,#0a121a)' },
];

const DEFAULT_THEME = { accent: 'default', font: 'default', bg: 'default' };
const getThemeKey = (chatType, id) =>
  `vaibes_${chatType === 'group' ? 'group' : 'dm'}_theme_v1${id ? `_${id}` : ''}`;

const loadTheme = (chatType, id) => {
  try {
    const saved = JSON.parse(localStorage.getItem(getThemeKey(chatType, id)));
    return saved && typeof saved === 'object' ? { ...DEFAULT_THEME, ...saved } : DEFAULT_THEME;
  } catch { return DEFAULT_THEME; }
};

const isImageUrl = (url = '') => /\.(jpe?g|png|gif|webp|svg)(\?.*)?$/i.test(url);

const topicTypeEmoji = (item) => {
  if (item.media_type === 'video' || item.attachments?.some(a => a.type?.startsWith('video/'))) return '🎬';
  if (item.media_type === 'youtube' || item.attachments?.some(a => a.type === 'youtube')) return '▶️';
  if (item.attachments?.some(a => a.type?.startsWith('image/'))) return '🖼️';
  return '📝';
};

const renderTopicHtml = (content) => {
  if (!content) return '';
  const trimmed = content.trim();
  if (trimmed.startsWith('<')) return trimmed;
  return `<p>${trimmed.replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`;
};

const InlineChatView = ({ type = 'dm', conversation, otherUser, group, product, onBack, autoStartAudio = false }) => {
  const { user } = useAuth();
  
  const tableName = type === 'group' ? 'dm_group_messages' : 'dm_messages';
  const idValue   = type === 'group' ? group?.id : conversation?.id;
  const idColumn  = type === 'group' ? 'group_id' : 'conversation_id';

  const [messages,     setMessages]     = useState([]);
  const [input,        setInput]        = useState('');
  const [sending,      setSending]      = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile,    setImageFile]    = useState(null);
  const [docFile,      setDocFile]      = useState(null);
  const [lightbox,     setLightbox]     = useState(null);

  const [theme, setTheme] = useState(() => loadTheme(type));
  const [showTheme, setShowTheme] = useState(false);

  const [senderProfiles, setSenderProfiles] = useState({});
  const [topic,     setTopic]     = useState(null);
  const [topicOpen, setTopicOpen] = useState(false);

  // Invite / members
  const [showInvite,     setShowInvite]     = useState(false);
  const [inviteQuery,    setInviteQuery]    = useState('');
  const [inviteResults,  setInviteResults]  = useState([]);
  const [inviteSearching, setInviteSearching] = useState(false);
  const [members,        setMembers]        = useState([]);

  // Live "soon" toast
  const [liveToast, setLiveToast] = useState(false);
  const liveToastTimer = useRef(null);

  const bottomRef    = useRef(null);
  const fileInputRef = useRef(null);
  const docInputRef  = useRef(null);
  const bgInputRef   = useRef(null);
  const channelRef   = useRef(null);

  const showTopicBar = type === 'group' && !!group?.wall_item_id;
  const topicImages  = topic?.attachments?.filter(a => a.type?.startsWith('image/')) || [];
  const memberIds    = new Set(members.map(m => m.id));

  const applyTheme = (patch) => {
  const next = { ...theme, ...patch };
  setTheme(next);
  try { localStorage.setItem(getThemeKey(type, idValue), JSON.stringify(next)); } catch {}
};

  const accentValue = ACCENT_PRESETS.find(p => p.id === theme.accent)?.value || null;
  const fontValue   = FONT_PRESETS.find(p => p.id === theme.font)?.value || null;
  const bgValue     = BG_PRESETS.find(p => p.id === theme.bg)?.value || null;
  const rootStyle = {
    ...(fontValue ? { fontFamily: fontValue } : {}),
    ...(bgValue ? { background: bgValue } : {}),
    ...((theme.bg === 'custom' && theme.bgUrl)
      ? { backgroundImage: `url(${theme.bgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
      : {}),
  };

  /* ── Messages + realtime ── */
  useEffect(() => {
    if ((type !== 'dm' && type !== 'group') || !idValue || !user) return;

    const load = async () => {
      const { data, error } = await supabase
        .from(tableName).select('*')
        .eq(idColumn, idValue)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });
      if (error) { console.error('Load messages error:', error); return; }
      setMessages(data || []);
    };
    load();

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const ch = supabase
      .channel(`icv_${type}_${idValue}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: tableName,
        filter: `${idColumn}=eq.${idValue}`,
      }, (p) => setMessages(prev => [...prev, p.new]))
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: tableName,
        filter: `${idColumn}=eq.${idValue}`,
      }, (p) => {
        if (p.new.deleted_at) setMessages(prev => prev.filter(m => m.id !== p.new.id));
      })
      .subscribe();

    channelRef.current = ch;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [idValue, user, type, tableName, idColumn]);

  /* ── Topic (wall item the room is tied to) ── */
  useEffect(() => {
    if (!showTopicBar) { setTopic(null); return; }
    let cancelled = false;
    supabase
      .from('user_creatives').select('*')
      .eq('id', group.wall_item_id).maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error('Topic load error:', error);
        setTopic(data || null);
      });
    return () => { cancelled = true; };
  }, [showTopicBar, group?.wall_item_id]);

  /* ── Sender profiles for group avatars/names ── */
  useEffect(() => {
    if (type !== 'group') return;
    const missing = [...new Set(
      messages.map(m => m.sender_id).filter(id => id && id !== user?.id && !senderProfiles[id])
    )];
    if (missing.length === 0) return;
    supabase
      .from('profiles').select('id, display_name, username, avatar_url')
      .in('id', missing)
      .then(({ data }) => {
        if (!data?.length) return;
        setSenderProfiles(prev => {
          const next = { ...prev };
          data.forEach(p => { next[p.id] = p; });
          return next;
        });
      });
  }, [messages, type, user?.id, senderProfiles]);

  /* ── Members list (when invite modal opens) ── */
  useEffect(() => {
    if (!showInvite || type !== 'group' || !group?.id) return;
    (async () => {
      const { data: rows } = await supabase
        .from('group_members').select('user_id').eq('group_id', group.id);
      const ids = (rows || []).map(r => r.user_id);
      if (ids.length === 0) { setMembers([]); return; }
      const { data: profs } = await supabase
        .from('profiles').select('id, display_name, username, avatar_url').in('id', ids);
      setMembers(profs || []);
    })();
  }, [showInvite, group?.id, type]);

  /* ── Invite search (debounced) ── */
  useEffect(() => {
    const q = inviteQuery.trim();
    if (q.length < 2) { setInviteResults([]); return; }
    setInviteSearching(true);
    const t = setTimeout(() => {
      supabase
        .from('profiles').select('id, display_name, username, avatar_url')
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(8)
        .then(({ data }) => { setInviteResults(data || []); setInviteSearching(false); });
    }, 250);
    return () => clearTimeout(t);
  }, [inviteQuery]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

    useEffect(() => {
    if (!showTheme && !showInvite && !topicOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { setShowTheme(false); setShowInvite(false); setTopicOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showTheme, showInvite, topicOpen]);

  const getName = () => {
    if (type === 'dm')      return otherUser?.display_name || otherUser?.username || 'User';
    if (type === 'group')   return group?.name || 'Group';
    if (type === 'product') return product?.name || 'Product';
    return 'Chat';
  };
  const getInitial      = () => getName()[0]?.toUpperCase() || '?';
  const getStatusLabel  = () => type === 'dm' ? 'Online' : type === 'group' ? 'Group chat' : product?.price || '—';
  const getStatusColor  = () => type === 'dm' ? '#22c55e' : type === 'group' ? '#a78bfa' : '#a78bfa';

  const pingLiveSoon = () => {
    setLiveToast(true);
    clearTimeout(liveToastTimer.current);
    liveToastTimer.current = setTimeout(() => setLiveToast(false), 2200);
  };

  const inviteUser = async (p) => {
    const { error } = await supabase
      .from('group_members').insert({ group_id: group.id, user_id: p.id });
    if (error) {
      alert(/duplicate|unique/i.test(error.message) ? 'Already a member.' : error.message);
      return;
    }
    setMembers(prev => [...prev, p]);
    setInviteQuery('');
    setInviteResults([]);
  };

  const handleBgSelect = (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file?.type.startsWith('image/')) return;
  if (file.size > 5 * 1024 * 1024) { alert('Max 5 MB'); return; }
  const ext  = file.name.split('.').pop();
  const path = `chat-bg/${user.id}-${Date.now()}.${ext}`;
  supabase.storage.from('dm-images').upload(path, file)
    .then(({ error }) => {
      if (error) throw error;
      const url = supabase.storage.from('dm-images').getPublicUrl(path).data.publicUrl;
      applyTheme({ bg: 'custom', bgUrl: url });
    })
    .catch(err => alert('Upload failed: ' + err.message));
};

  const handleDelete = async (id) => {
    const snapshot = messages;
    setMessages(prev => prev.filter(m => m.id !== id));

    const { error } = await supabase
      .from(tableName)
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('sender_id', user.id);

    if (error) {
      console.error('Delete failed:', error.message);
      setMessages(snapshot);
      alert(`Couldn't delete: ${error.message}`);
      return;
    }

    if (type === 'dm') {
      const { data: last } = await supabase
        .from('dm_messages').select('content,image_url,created_at')
        .eq('conversation_id', conversation.id).is('deleted_at', null)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      await supabase.from('dm_conversations').update({
        last_message:    last ? (last.content || '📎 Attachment') : '',
        last_message_at: last?.created_at || new Date().toISOString(),
      }).eq('id', conversation.id);
    }
  };

  const handleDownload = useCallback(async (url, filename) => {
    try {
      const blob = await (await fetch(url)).blob();
      const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(blob),
        download: filename || url.split('/').pop() || 'file',
      });
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { /* silent */ }
  }, []);

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file?.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) { alert('Max 5 MB'); return; }
    setImageFile(file);
    setDocFile(null);
    const r = new FileReader();
    r.onloadend = () => setImagePreview(r.result);
    r.readAsDataURL(file);
  };

  const handleDocSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert('Max 10 MB'); return; }
    setDocFile(file);
    setImageFile(null);
    setImagePreview(null);
  };

  const clearImage = () => {
    setImageFile(null); setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  const clearDoc = () => {
    setDocFile(null);
    if (docInputRef.current) docInputRef.current.value = '';
  };

  const uploadAttachment = async (file) => {
    const ext = file.name.split('.').pop();
    const path = `${idValue}/${user.id}-${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('dm-images').upload(path, file);
    if (error) throw error;
    return supabase.storage.from('dm-images').getPublicUrl(path).data.publicUrl;
  };

  const handleSend = async () => {
    if ((!input.trim() && !imageFile && !docFile) || sending || !idValue) return;
    setSending(true);
    try {
      let attachmentUrl = null;
      let contentText = input.trim() || null;

      if (imageFile) {
        attachmentUrl = await uploadAttachment(imageFile);
      } else if (docFile) {
        attachmentUrl = await uploadAttachment(docFile);
        contentText = input.trim() ? `${docFile.name} — ${input.trim()}` : docFile.name;
      }

      const payload = type === 'group'
        ? { group_id: idValue, sender_id: user.id, content: contentText, image_url: attachmentUrl }
        : { conversation_id: idValue, sender_id: user.id, content: contentText, image_url: attachmentUrl };

      const { error } = await supabase.from(tableName).insert(payload);
      if (error) throw error;

      if (type === 'dm') {
        await supabase.from('dm_conversations').update({
          last_message:     attachmentUrl ? (contentText || (imageFile ? '📷 Photo' : '📎 File')) : contentText,
          last_message_at:  new Date().toISOString(),
          hidden_by_user1:  false,
          hidden_by_user2:  false,
        }).eq('id', conversation.id);
      }

      setInput(''); clearImage(); clearDoc();
    } catch (err) { console.error('Send error:', err); }
    finally { setSending(false); }
  };

  return (
    <div className="icv-root" style={rootStyle}>

      {liveToast && <div className="icv-live-toast">🎙️ Live audio is coming soon!</div>}

      <div className="icv-header">
        <button className="icv-back" onClick={onBack} aria-label="Back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>

        <div className="icv-av">
          {type === 'dm' && otherUser?.avatar_url
            ? <img src={otherUser.avatar_url} alt="" />
            : type === 'group'
              ? (group?.icon || '👥')
              : getInitial()}
        </div>

        <div className="icv-head-info">
          {!showTopicBar && <div className="icv-head-name">{getName()}</div>}
          <div className="icv-head-status" style={{ color: getStatusColor() }}>{getStatusLabel()}</div>
        </div>

        <div className="icv-head-actions">
          {type === 'dm' && (
            <button className="icv-icon-btn" title="Voice call">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18l1.08-1.08a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </button>
          )}

          {type === 'group' && !LIVE_AUDIO_ENABLED && (
            <button className="icv-live-pill" onClick={pingLiveSoon} title="Live audio">
              🎙️ <span className="icv-live-pill-txt">Live</span>
              <span className="icv-live-pill-badge">soon</span>
            </button>
          )}

          {type === 'group' && (
            <button className="icv-icon-btn" title="Invite members" onClick={() => setShowInvite(s => !s)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="8.5" cy="7" r="4"/>
                <line x1="20" y1="8" x2="20" y2="14"/>
                <line x1="23" y1="11" x2="17" y2="11"/>
              </svg>
            </button>
          )}

          <button className="icv-icon-btn" title="Video">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="23 7 16 12 23 17 23 7"/>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
          </button>
          {(type === 'dm' || type === 'group') && (
            <button className="icv-icon-btn" title="Chat appearance" onClick={() => setShowTheme(s => !s)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Topic bar: the room's single, clickable title ── */}
      {showTopicBar && (
        <button type="button" className="icv-topic-bar" onClick={() => setTopicOpen(o => !o)} disabled={!topic}>
          <div className="icv-topic-thumb-circle">
            {topicImages.length > 0
              ? <img src={topicImages[0].url} alt="" />
              : (topic ? topicTypeEmoji(topic) : (group?.icon || '📚'))}
          </div>
          <div className="icv-topic-info">
            <div className="icv-head-name">{topic?.title || 'Loading topic…'}</div>
            <div className="icv-topic-cta">{topicOpen ? 'Close topic ▴' : 'View topic ▾'}</div>
          </div>
        </button>
      )}

            {/* ── Topic panel: right slide-over, out of flow — chat never shifts ── */}
      {showTopicBar && topicOpen && topic && (
  <div className="icv-topic-panel">
    <div className="icv-topic-panel-head">
      <span className="icv-topic-panel-title">{topic.title}</span>
      <button className="icv-icon-btn" title="Close topic" onClick={() => setTopicOpen(false)}>✕</button>
    </div>
    <div className="icv-topic-panel-body">
      {topicImages.slice(0, 3).map((img, i) => (
        <img key={i} src={img.url} alt="" className="icv-topic-panel-img"
          onClick={() => setLightbox(img.url)} />
      ))}
      {topic.content ? (
        <div className="icv-topic-panel-content"
          dangerouslySetInnerHTML={{ __html: renderTopicHtml(topic.content) }} />
      ) : topicImages.length === 0 ? (
        <div className="icv-topic-missing">No content on this topic.</div>
      ) : null}
    </div>
  </div>
)}

      {showTheme && (type === 'dm' || type === 'group') && ReactDOM.createPortal(
        <div className="msg-theme-overlay" onClick={() => setShowTheme(false)}>
          <div className="msg-theme-modal" onClick={e => e.stopPropagation()}>
            <div className="msg-theme-modal-head">
              <span className="msg-theme-modal-title">Chat Appearance</span>
              <button className="msg-theme-modal-close" onClick={() => setShowTheme(false)}>✕</button>
            </div>

            <div className="msg-theme-modal-body">
              <div className="msg-theme-row">
                <span className="msg-theme-lbl">Bubble color</span>
                <div className="msg-swatches">
                  {ACCENT_PRESETS.map(p => (
                    <button
                      key={p.id}
                      className={`msg-swatch ${theme.accent === p.id ? 'active' : ''}`}
                      style={{ background: p.value || 'linear-gradient(135deg,#8b5cf6,#22c55e,#f59e0b)' }}
                      title={p.label}
                      onClick={() => applyTheme({ accent: p.id })}
                    />
                  ))}
                </div>
              </div>

              <div className="msg-theme-row">
                <span className="msg-theme-lbl">Font</span>
                <div className="msg-theme-chips">
                  {FONT_PRESETS.map(p => (
                    <button
                      key={p.id}
                      className={`msg-theme-chip ${theme.font === p.id ? 'active' : ''}`}
                      onClick={() => applyTheme({ font: p.id })}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="msg-theme-row">
                <span className="msg-theme-lbl">Background</span>
                <div className="msg-theme-chips">
                  {BG_PRESETS.map(p => (
                    <button
                      key={p.id}
                      className={`msg-theme-chip ${theme.bg === p.id ? 'active' : ''}`}
                      onClick={() => applyTheme({ bg: p.id, bgUrl: null })}
                    >
                      {p.label}
                    </button>
                  ))}
                  <button
                    className={`msg-theme-chip ${theme.bg === 'custom' ? 'active' : ''}`}
                    onClick={() => bgInputRef.current?.click()}
                  >
                    🖼️ Upload
                  </button>
                  <input ref={bgInputRef} type="file" accept="image/*"
                    style={{ display: 'none' }} onChange={handleBgSelect} />
                </div>
              </div>
            </div>

            <div className="msg-theme-modal-foot">
              <button className="msg-theme-reset-btn" onClick={() => applyTheme(DEFAULT_THEME)}>Reset to default</button>
              <button className="msg-theme-done-btn" onClick={() => setShowTheme(false)}>Done</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showInvite && type === 'group' && ReactDOM.createPortal(
        <div className="msg-theme-overlay" onClick={() => setShowInvite(false)}>
          <div className="msg-theme-modal" onClick={e => e.stopPropagation()}>
            <div className="msg-theme-modal-head">
              <span className="msg-theme-modal-title">👥 Room members</span>
              <button className="msg-theme-modal-close" onClick={() => setShowInvite(false)}>✕</button>
            </div>
            <div className="msg-theme-modal-body">
              <div className="um-search-wrap" style={{ marginBottom: 10 }}>
                <input type="text" className="um-search-input" placeholder="Search username or name…"
                  value={inviteQuery} onChange={e => setInviteQuery(e.target.value)} />
              </div>

              {inviteQuery.trim().length >= 2 && (
                <div className="icv-invite-results">
                  {inviteSearching && <div className="um-list-empty"><p>Searching…</p></div>}
                  {!inviteSearching && inviteResults.filter(r => !memberIds.has(r.id)).length === 0 && (
                    <div className="um-list-empty"><p>No one found</p></div>
                  )}
                  {!inviteSearching && inviteResults.filter(r => !memberIds.has(r.id)).map(p => (
                    <button key={p.id} className="um-conv-item" onClick={() => inviteUser(p)}>
                      <div className="um-conv-avatar">
                        <div className="um-avatar-placeholder">
                          {p.avatar_url
                            ? <img src={p.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                            : (p.display_name || p.username || '?').charAt(0).toUpperCase()}
                        </div>
                      </div>
                      <div className="um-conv-info">
                        <div className="um-conv-name">{p.display_name || p.username}</div>
                        <div className="um-conv-preview">@{p.username}</div>
                      </div>
                      <span className="icv-invite-add">+ Add</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="icv-invite-members">
                <span className="msg-theme-lbl">In this room ({members.length})</span>
                {members.map(m => (
                  <div key={m.id} className="um-conv-item" style={{ cursor: 'default' }}>
                    <div className="um-conv-avatar">
                      <div className="um-avatar-placeholder">
                        {m.avatar_url
                          ? <img src={m.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                          : (m.display_name || m.username || '?').charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <div className="um-conv-info">
                      <div className="um-conv-name">{m.display_name || m.username}</div>
                      <div className="um-conv-preview">@{m.username}{m.id === user?.id ? ' (you)' : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {type === 'group' && group && LIVE_AUDIO_ENABLED && (
        <LiveAudioPanel group={group} autoStart={autoStartAudio} />
      )}

      <div className="icv-messages">

        {type === 'dm' && messages.length === 0 && (
          <div className="icv-empty"><span>👋</span><p>Say hello to {getName()}!</p></div>
        )}
        {type === 'group' && messages.length === 0 && (
          <div className="icv-empty"><span>💬</span><p>No messages yet — start the conversation!</p></div>
        )}
        {type === 'product' && product && (
          <div className="icv-product-preview">
            <div className="icv-product-thumb">{product.icon}</div>
            <div className="icv-product-name">{product.name}</div>
            <div className="icv-product-seller">by {product.seller}</div>
            <div className="icv-product-price">{product.price}</div>
            <button className="icv-product-cta">View Product →</button>
          </div>
        )}

        {(type === 'dm' || type === 'group') && messages.map(msg => {
          const isOwn = msg.sender_id === user?.id;
          const time  = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const attachmentIsImage = msg.image_url && isImageUrl(msg.image_url);
          const attachmentIsFile  = msg.image_url && !attachmentIsImage;
          const sender = type === 'group' ? senderProfiles[msg.sender_id] : null;

          return (
            <div key={msg.id} className={`icv-mrow ${isOwn ? 'mine' : ''}`}>
              {!isOwn && (
                <div className="icv-mav them">
                  {type === 'dm' && otherUser?.avatar_url
                    ? <img src={otherUser.avatar_url} alt="" />
                    : type === 'group'
                      ? (sender?.avatar_url
                          ? <img src={sender.avatar_url} alt="" />
                          : (sender?.display_name || sender?.username || '?').charAt(0).toUpperCase())
                      : getInitial()}
                </div>
              )}
              <div className="icv-bubble-wrap">
                {type === 'group' && !isOwn && (
                  <span className="icv-sender-name">
                    {sender?.display_name || sender?.username || 'Member'}
                  </span>
                )}
                <div
                  className={`icv-bubble ${isOwn ? 'me' : 'them'}`}
                  style={isOwn && (type === 'dm' || type === 'group') && accentValue ? { background: accentValue } : undefined}
                >
                  {attachmentIsImage && (
                    <img src={msg.image_url} alt="shared" className="icv-img"
                      onClick={() => setLightbox(msg.image_url)} />
                  )}
                  {attachmentIsFile && (
                    <button
                      type="button"
                      onClick={() => handleDownload(msg.image_url, msg.content)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 10px', color: 'inherit', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}
                    >
                      📄 <span style={{ textDecoration: 'underline' }}>{msg.content || 'Download file'}</span>
                    </button>
                  )}
                  {msg.content && attachmentIsImage && <span>{msg.content}</span>}
                  {msg.content && !msg.image_url && <span>{msg.content}</span>}
                </div>
                <div className="icv-bubble-foot">
                  <span className="icv-ts">{time}</span>
                  {attachmentIsImage && (
                    <button className="icv-ghost-btn" onClick={() => handleDownload(msg.image_url)} title="Download">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                    </button>
                  )}
                  {isOwn && (
                    <button className="icv-ghost-btn icv-del" onClick={() => handleDelete(msg.id)} title="Delete">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        <path d="M10 11v6m4-6v6"/>
                        <path d="M9 6V4h6v2"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              {isOwn && (
                <div className="icv-mav me">
                  {user?.user_metadata?.avatar_url
                    ? <img src={user.user_metadata.avatar_url} alt="" />
                    : (user?.email?.[0]?.toUpperCase() || 'Y')}
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {(imagePreview || docFile) && (
        <div className="icv-img-preview">
          {imagePreview ? (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <img src={imagePreview} alt="" className="icv-preview-thumb" />
              <button className="icv-clear-img" onClick={clearImage}>✕</button>
            </div>
          ) : (
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 10px' }}>
              📄 <span style={{ fontSize: 13 }}>{docFile.name}</span>
              <button className="icv-clear-img" onClick={clearDoc}>✕</button>
            </div>
          )}
          <span className="icv-preview-label">{imagePreview ? 'Image ready' : 'File ready'}</span>
        </div>
      )}

      {type === 'dm' && (
        <div className="icv-chips">
          <button className="icv-chip" onClick={() => fileInputRef.current?.click()}>📷 Photo</button>
          <button className="icv-chip" onClick={() => docInputRef.current?.click()}>📄 File</button>
          <input ref={fileInputRef} type="file" accept="image/*"
            style={{ display: 'none' }} onChange={handleImageSelect} />
          <input ref={docInputRef} type="file"
            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.zip"
            style={{ display: 'none' }} onChange={handleDocSelect} />
        </div>
      )}

      {type === 'group' && (
        <div className="icv-chips">
          <button className="icv-chip" onClick={() => fileInputRef.current?.click()}>📷 Photo</button>
          <input ref={fileInputRef} type="file" accept="image/*"
            style={{ display: 'none' }} onChange={handleImageSelect} />
        </div>
      )}

      {(type === 'dm' || type === 'group') && (
        <div className="icv-composer">
          <input
            className="icv-input"
            type="text"
            placeholder={imageFile ? 'Add a caption…' : docFile ? 'Add a note (optional)…' : `Message ${getName()}…`}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          />
          <button className="icv-send" onClick={handleSend}
            disabled={(!input.trim() && !imageFile && !docFile) || sending}>
            {sending ? '…' : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            )}
          </button>
        </div>
      )}

      {lightbox && ReactDOM.createPortal(
        <div className="icv-lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="full" onClick={e => e.stopPropagation()} />
          <button className="icv-lightbox-close" onClick={() => setLightbox(null)}>✕</button>
        </div>,
        document.body
      )}
    </div>
  );
};

export default InlineChatView;