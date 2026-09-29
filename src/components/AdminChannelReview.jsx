import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import './AdminChannelReview.css';

const ADMIN_EMAIL = 'noctirionvale@gmail.com';

// Same taxonomy already used for Studio/Subject Quiz — lets you re-tag a
// submission's subject before approving, in case the submitter picked loosely.
const SUBJECT_OPTIONS = ['General', 'Math', 'Science', 'Biology', 'Chemistry', 'Physics', 'Astronomy',
  'History', 'English', 'Filipino', 'Programming', 'Technology', 'Arts', 'Personalities', 'Celebrities',
  'Television', 'Entertainment', 'Meme', 'Animals', 'Movies', 'Sports', 'Anime', 'Music', 'Other'];

const AdminChannelReview = () => {
  const { user } = useAuth();
  const isAdmin = user?.email === ADMIN_EMAIL;

  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState(null);
  const [subjectOverrides, setSubjectOverrides] = useState({}); // channelId -> subject, only if changed

  const fetchPending = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('vidfeed_channels')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (!error) setPending(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { if (isAdmin) fetchPending(); }, [isAdmin, fetchPending]);

  const handleApprove = async (channel) => {
    setActingId(channel.id);
    const finalSubject = subjectOverrides[channel.id] || channel.subject;
    const { error } = await supabase
      .from('vidfeed_channels')
      .update({
        status: 'approved',
        subject: finalSubject,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      })
      .eq('id', channel.id);
    if (error) { alert('Failed to approve: ' + error.message); setActingId(null); return; }
    setPending(prev => prev.filter(c => c.id !== channel.id));
    setActingId(null);
  };

  const handleReject = async (channel) => {
    if (!window.confirm(`Reject "${channel.title}"? This channel will not be shown to any user.`)) return;
    setActingId(channel.id);
    const { error } = await supabase
      .from('vidfeed_channels')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      })
      .eq('id', channel.id);
    if (error) { alert('Failed to reject: ' + error.message); setActingId(null); return; }
    setPending(prev => prev.filter(c => c.id !== channel.id));
    setActingId(null);
  };

  if (!isAdmin) {
    return (
      <div className="acr-wrapper">
        <div className="acr-denied">🔒 Admin access only.</div>
      </div>
    );
  }

  return (
    <div className="acr-wrapper">
      <div className="acr-header">
        <h2>📺 VidFeed Channel Review</h2>
        <span className="acr-count">{pending.length} pending</span>
      </div>

      {loading ? (
        <div className="acr-loading">Loading…</div>
      ) : pending.length === 0 ? (
        <div className="acr-empty">✨ Nothing pending — you're all caught up.</div>
      ) : (
        <div className="acr-list">
          {pending.map(channel => (
            <div key={channel.id} className="acr-card">
              <div className="acr-card-media">
                {channel.thumbnail
                  ? <img src={channel.thumbnail} alt={channel.title} />
                  : <div className="acr-card-media-placeholder">📺</div>}
              </div>
              <div className="acr-card-body">
                <div className="acr-card-title-row">
                  <h3>{channel.title}</h3>
                  {channel.subscriber_count != null && (
                    <span className="acr-sub-count">
                      {Intl.NumberFormat('en', { notation: 'compact' }).format(channel.subscriber_count)} subs
                    </span>
                  )}
                </div>
                {channel.description && <p className="acr-card-desc">{channel.description}</p>}

                <div className="acr-card-justification">
                  <span className="acr-field-label">Submitter's justification</span>
                  <p>{channel.justification || '(none provided)'}</p>
                </div>

                <div className="acr-card-subject-row">
                  <span className="acr-field-label">Subject</span>
                  <select
                    value={subjectOverrides[channel.id] || channel.subject}
                    onChange={e => setSubjectOverrides(prev => ({ ...prev, [channel.id]: e.target.value }))}
                    className="acr-subject-select"
                  >
                    {SUBJECT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className="acr-card-actions">
                  <button
                    className="acr-approve-btn"
                    onClick={() => handleApprove(channel)}
                    disabled={actingId === channel.id}
                  >
                    {actingId === channel.id ? '⏳' : '✅'} Approve
                  </button>
                  <button
                    className="acr-reject-btn"
                    onClick={() => handleReject(channel)}
                    disabled={actingId === channel.id}
                  >
                    {actingId === channel.id ? '⏳' : '❌'} Reject
                  </button>
                  <a
                    href={`https://youtube.com/channel/${channel.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="acr-view-link"
                  >
                    ↗ View on YouTube
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminChannelReview;