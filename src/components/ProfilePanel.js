import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const ProfilePanel = ({ onClose, embedded = false }) => {
  const { user, profile, fetchProfile } = useAuth();
  const fileInputRef = useRef(null);

  // ✅ 1. State initialization
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  
  // ✅ 2. Sync state with props/profile when they change
  // This fixes the issue where uploading changes local state, 
  // but a re-render from AuthContext might reset it if not handled,
  // or ensures initial load is correct.
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || user?.user_metadata?.display_name || '');
      setAvatarUrl(profile.avatar_url || user?.user_metadata?.avatar_url || '');
    } else if (user) {
      // Fallback if profile isn't loaded yet but user is
      setDisplayName(user.user_metadata?.display_name || '');
      setAvatarUrl(user.user_metadata?.avatar_url || '');
    }
  }, [profile, user]);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Reset states
    setError('');
    setMessage('');
    
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be under 2MB.');
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      // ✅ Use a consistent naming convention to avoid cluttering bucket
      // Or keep timestamp if you want history. Let's stick to your logic but clean it.
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // ✅ Get public URL immediately
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // ✅ Update local state immediately for UI feedback
      setAvatarUrl(publicUrl);
      setMessage('✅ Photo uploaded! Hit Save Changes to apply.');

    } catch (err) {
      console.error('Upload error:', err);
      setError('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    // ✅ Prevent duplicate submissions
    if (saving || uploading) return;

    setSaving(true);
    setError('');
    setMessage('');

    try {
      // ✅ 1. Update Auth Metadata (Optional, but good for consistency)
      // Note: updateUser can be slow. If you don't need display_name in JWT, skip this.
      const { error: authError } = await supabase.auth.updateUser({
        data: { display_name: displayName, avatar_url: avatarUrl }
      });
      
      if (authError) {
        console.warn('Auth metadata update failed, continuing with DB update...', authError);
        // We often continue because the DB profile is the source of truth for UI
      }

      // ✅ 2. Update Database Profile
      const { error: dbError } = await supabase
        .from('profiles')
        .update({
          display_name: displayName,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString() // Good practice to have an updated_at column
        })
        .eq('id', user.id);

      if (dbError) throw dbError;

      // ✅ 3. Refresh Global Context
      // Await this to ensure the next render has fresh data
      await fetchProfile();

      setMessage('✅ Profile saved successfully!');
      
      // ✅ Optional: Close modal after success if not embedded
      if (!embedded) {
        setTimeout(() => {
          onClose?.();
        }, 1500);
      }

    } catch (err) {
      console.error('Save error:', err);
      setError('Save failed: ' + err.message);
    } finally {
      setSaving(false);
      // Clear message after a delay
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // ✅ Early return if no user
  if (!user) return null;

  return (
    <div className={embedded ? 'profile-panel-embedded' : 'profile-panel'}>
      {!embedded && (
        <div className="profile-panel-header">
          <h3>Edit Profile</h3>
          <button className="close-modal-btn" onClick={onClose} aria-label="Close">
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
          onClick={() => !uploading && fileInputRef.current?.click()}
          title="Click to change avatar"
          style={{ cursor: uploading ? 'wait' : 'pointer' }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" className="profile-avatar-img" />
          ) : (
            <div className="profile-avatar-placeholder">
              {displayName?.charAt(0)?.toUpperCase() || '?'}
            </div>
          )}
          
          <div className="profile-avatar-overlay">
            {uploading ? (
              <span>Uploading...</span>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                  <circle cx="12" cy="13" r="4"></circle>
                </svg>
                <span>Change</span>
              </>
            )}
          </div>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleAvatarUpload}
          disabled={uploading}
        />
        <p className="profile-avatar-hint">JPG, PNG under 2MB</p>
      </div>

      <div className="profile-form">
        <div className="profile-field">
          <label htmlFor="displayName">Display Name</label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your display name"
            className="auth-input"
            disabled={saving}
          />
        </div>
        <div className="profile-field">
          <label>Email Address</label>
          <input
            type="email"
            value={user.email || ''}
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