import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const ProfilePanel = ({ onClose, embedded = false }) => {
  // ✅ 1. Pull BOTH user and our new profile object
  const { user, profile, fetchProfile } = useAuth();
  const fileInputRef = useRef(null);

  // ✅ 2. Initialize from the database profile first, fallback to auth metadata
  const [displayName, setDisplayName] = useState(
    profile?.display_name || user?.user_metadata?.display_name || user?.user_metadata?.full_name || ''
  );
  const [email] = useState(user?.email || '');
  const [avatarUrl, setAvatarUrl] = useState(
    profile?.avatar_url || user?.user_metadata?.avatar_url || ''
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleAvatarUpload = async (e) => {
  const file = e.target.files[0]
  if (!file) return
  if (!file.type.startsWith('image/')) { setError('Please upload an image file.'); return }
  if (file.size > 2 * 1024 * 1024) { setError('Image must be under 2MB.'); return }

  setUploading(true)
  setError('')
  setMessage('')

  try {
    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}-${Date.now()}.${fileExt}`
    const filePath = `avatars/${fileName}`

    // ✅ Check bucket name matches exactly
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true })

    if (uploadError) throw uploadError

    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath)

    setAvatarUrl(data.publicUrl)
    setMessage('✅ Photo uploaded! Hit Save Changes to apply.')

  } catch (err) {
    console.error('Upload error:', err)
    setError('Upload failed: ' + err.message)
  } finally {
    setUploading(false) // ✅ Always clears uploading state
  }
}

  const handleSave = async () => {
  setSaving(true)
  setError('')
  setMessage('')
  try {
    await supabase.auth.updateUser({
      data: { display_name: displayName, avatar_url: avatarUrl }
    })

    const { error: dbError } = await supabase
      .from('profiles')
      .update({
        display_name: displayName,
        avatar_url: avatarUrl
      })
      .eq('id', user.id)

    if (dbError) throw dbError

    // ✅ Refresh global profile so navbar + everywhere updates instantly
    await fetchProfile()

    setMessage('✅ Profile saved successfully!')

    // Auto-clear message after 3 seconds
    setTimeout(() => setMessage(''), 3000)

  } catch (err) {
    setError('Save failed: ' + err.message)
  } finally {
    setSaving(false)
  }
}

  return (
    <div className={embedded ? 'profile-panel-embedded' : 'profile-panel'}>

      {/* Header — only when not embedded */}
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

      {/* Avatar */}
      <div className="profile-avatar-section">
        <div
          className="profile-avatar-wrapper"
          onClick={() => fileInputRef.current.click()}
          title="Click to change avatar"
        >
          {avatarUrl
            ? <img src={avatarUrl} alt="avatar" className="profile-avatar-img" />
            : <div className="profile-avatar-placeholder">
                {displayName?.charAt(0)?.toUpperCase() || '?'}
              </div>
          }
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

      {/* Form */}
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