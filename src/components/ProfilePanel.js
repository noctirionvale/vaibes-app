// src/components/ProfilePanel.jsx
import React, { useRef, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const ProfilePanel = ({ onClose, embedded = false }) => {
  const { user, profile, fetchProfile } = useAuth();
  const fileInputRef = useRef(null);
  const isMounted = useRef(true);

  // Local form state – initialised from context
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [email] = useState(user?.email || '');

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Sync local state when context profile changes
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setAvatarUrl(profile.avatar_url || '');
    } else if (user?.user_metadata) {
      setDisplayName(user.user_metadata.display_name || user.user_metadata.full_name || '');
      setAvatarUrl(user.user_metadata.avatar_url || '');
    }
  }, [profile, user]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be under 2MB.');
      return;
    }

    setUploading(true);
    setError('');
    setMessage('');

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      if (isMounted.current) {
        setAvatarUrl(data.publicUrl);
        setMessage('✅ Photo uploaded! Hit Save Changes to apply.');
      }
    } catch (err) {
      if (isMounted.current) setError('Upload failed: ' + err.message);
    } finally {
      if (isMounted.current) setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setMessage('');

    // Safety timeout – force saving off after 5 seconds
    const timeoutId = setTimeout(() => {
      if (isMounted.current && saving) {
        setSaving(false);
        setError('Save timed out, but changes may have been applied. Please refresh.');
      }
    }, 5000);

    try {
      // 1. Update auth metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: { display_name: displayName, avatar_url: avatarUrl }
      });
      if (authError) throw authError;

      // 2. Update profiles table
      const { error: dbError } = await supabase
        .from('profiles')
        .update({ display_name: displayName, avatar_url: avatarUrl })
        .eq('id', user.id);
      if (dbError) throw dbError;

      // 3. Refresh context profile in background – NO AWAIT
      fetchProfile().catch(err => console.error('Background profile refresh failed:', err));

      if (isMounted.current) {
        setMessage('✅ Profile saved successfully!');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      if (isMounted.current) setError('Save failed: ' + err.message);
    } finally {
      clearTimeout(timeoutId);
      if (isMounted.current) setSaving(false);
    }
  };

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

      <div className="profile-avatar-section">
        <div
          className="profile-avatar-wrapper"
          onClick={() => fileInputRef.current?.click()}
          title="Click to change avatar"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" className="profile-avatar-img" />
          ) : (
            <div className="profile-avatar-placeholder">
              {displayName?.charAt(0)?.toUpperCase() || '?'}
            </div>
          )}
          <div className="profile-avatar-overlay">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
              <circle cx="12" cy="13" r="4"></circle>
            </svg>
            <span>{uploading ? 'Uploading...' : 'Change'}</span>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleAvatarUpload}
        />
        <p className="profile-avatar-hint">JPG, PNG under 2MB</p>
      </div>

      <div className="profile-form">
        <div className="profile-field">
          <label>Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Your display name"
            className="auth-input"
          />
        </div>
        <div className="profile-field">
          <label>Email Address</label>
          <input
            type="email"
            value={email}
            disabled
            className="auth-input disabled-input"
          />
          <span className="field-hint">Email cannot be changed</span>
        </div>
      </div>

      {error && <p className="auth-error">{error}</p>}
      {message && <p className="auth-success">{message}</p>}

      <button
        className="modal-action-btn"
        onClick={handleSave}
        disabled={saving || uploading}
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
};

export default ProfilePanel;