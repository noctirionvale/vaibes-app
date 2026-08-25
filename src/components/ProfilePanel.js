// src/components/ProfilePanel.jsx
import React, { useRef, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import './ProfilePanel.css';

const ProfilePanel = ({ onClose, embedded = false }) => {
  const { user, profile, fetchProfile } = useAuth();
  const fileInputRef = useRef(null);
  const isMounted = useRef(true);

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [email] = useState(user?.email || '');

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [usernameChecking, setUsernameChecking] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setUsername(profile.username || '');
      setAvatarUrl(profile.avatar_url || '');
    } else if (user?.user_metadata) {
      setDisplayName(user.user_metadata.display_name || user.user_metadata.full_name || '');
      setUsername(user.user_metadata.username || '');
      setAvatarUrl(user.user_metadata.avatar_url || '');
    }
  }, [profile, user]);

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  /* Debounced username availability check */
  useEffect(() => {
    if (!username || username.length < 3) {
      setUsernameError('');
      return;
    }
    const handler = setTimeout(async () => {
      setUsernameChecking(true);
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', username.toLowerCase())
          .neq('id', user.id)
          .maybeSingle();
        if (isMounted.current) setUsernameError(data ? 'Username already taken' : '');
      } catch (err) {
        console.error('Username check failed:', err);
      } finally {
        if (isMounted.current) setUsernameChecking(false);
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [username, user.id]);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please upload an image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Image must be under 5MB.'); return; }

    setUploading(true); setError(''); setMessage('');
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `avatars/${user.id}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      if (isMounted.current) setMessage('✅ Photo ready — hit Save to apply.');
      if (isMounted.current) setAvatarUrl(data.publicUrl);
    } catch (err) {
      if (isMounted.current) setError('Upload failed: ' + err.message);
    } finally {
      if (isMounted.current) setUploading(false);
    }
  };

  const handleSave = async () => {
    if (usernameError) { setError('Please fix username errors before saving.'); return; }
    setSaving(true); setError(''); setMessage('');

    const timeoutId = setTimeout(() => {
      if (isMounted.current && saving) {
        setSaving(false);
        setError('Save timed out, but changes may have been applied. Please refresh.');
      }
    }, 5000);

    try {
      const cleanUsername = username.toLowerCase().trim();
      const { error: authError } = await supabase.auth.updateUser({
        data: { display_name: displayName, avatar_url: avatarUrl, username: cleanUsername },
      });
      if (authError) throw authError;

      const { error: dbError } = await supabase
        .from('profiles')
        .update({ display_name: displayName, avatar_url: avatarUrl, username: cleanUsername })
        .eq('id', user.id);
      if (dbError) throw dbError;

      fetchProfile().catch(err => console.error('Background profile refresh failed:', err));

      if (isMounted.current) {
        setMessage('✅ Profile saved!');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      if (isMounted.current) setError('Save failed: ' + err.message);
    } finally {
      clearTimeout(timeoutId);
      if (isMounted.current) setSaving(false);
    }
  };

  const usernameOk = username && username.length >= 3 && !usernameError && !usernameChecking;

  return (
    <div className={embedded ? 'profile-panel-embedded' : 'profile-panel'}>
      {!embedded && (
        <div className="profile-panel-header">
          <h3>Edit Profile</h3>
          <button className="close-modal-btn" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      )}

      <div className="profile-compact">
        {/* Identity row: avatar + both name inputs side by side */}
        <div className="pc-top">
        <button type="button" className="pc-avatar" title="JPG/PNG under 5MB — click to change"
            onClick={() => fileInputRef.current?.click()}>
            {avatarUrl
              ? <img src={avatarUrl} alt="" />
              : <span>{displayName?.charAt(0)?.toUpperCase() || '?'}</span>}
            <span className="pc-avatar-badge">{uploading ? '…' : '📷'}</span>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*"
            style={{ display: 'none' }} onChange={handleAvatarUpload} />

          <div className="pc-fields">
            <div className="pc-field">
              <label>Display name</label>
              <input className="pc-input" type="text" value={displayName}
                onChange={e => setDisplayName(e.target.value)} placeholder="Your display name" />
            </div>
            <div className="pc-field">
              <label>Username</label>
              <div className="pc-username-row">
                <span className="pc-at">@</span>
                <input
                  className="pc-input pc-username"
                  placeholder="letters, numbers, _"
                  value={username}
                  maxLength={30}
                  onChange={e => {
                    setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase());
                    setUsernameError('');
                  }}
                />
                <span className={`pc-username-status ${usernameError ? 'err' : usernameChecking ? '' : 'ok'}`}>
                  {usernameChecking ? '…' : usernameError ? '✕' : usernameOk ? '✓' : ''}
                </span>
              </div>
            </div>
          </div>
        </div>

        {(usernameError || usernameOk) && (
          <p className={`pc-status-line ${usernameError ? 'err' : 'ok'}`}>
            {usernameError || `@${username} is available`}
          </p>
        )}

        {/* Email: read-only fact, not a form field */}
        <div className="pc-email" title="Email cannot be changed">
          <span className="pc-email-lock">🔒</span>
          <span className="pc-email-addr">{email}</span>
        </div>

        {error && <p className="auth-error">{error}</p>}
        {message && <p className="auth-success">{message}</p>}

        <button className="pc-save" onClick={handleSave} disabled={saving || uploading}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};

export default ProfilePanel;