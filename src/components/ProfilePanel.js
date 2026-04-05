import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useRef, useState, useEffect } from 'react';

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

  // Sync local state when context profile changes (e.g., after fetchProfile)
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setAvatarUrl(profile.avatar_url || '');
    } else if (user?.user_metadata) {
      // Fallback to auth metadata if profile not yet loaded
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

      // 3. Refresh context profile in background – never await
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

  // Render (unchanged except for className details)
  return (
    <div className={embedded ? 'profile-panel-embedded' : 'profile-panel'}>
      {!embedded && (
        <div className="profile-panel-header">
          <h3>Edit Profile</h3>
          <button className="close-modal-btn" onClick={onClose}>✕</button>
        </div>
      )}

      <div className="profile-avatar-section">
        <div className="profile-avatar-wrapper" onClick={() => fileInputRef.current?.click()}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" className="profile-avatar-img" />
          ) : (
            <div className="profile-avatar-placeholder">
              {displayName?.charAt(0)?.toUpperCase() || '?'}
            </div>
          )}
          <div className="profile-avatar-overlay">
            <span>{uploading ? 'Uploading...' : 'Change'}</span>
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleAvatarUpload} />
        <p className="profile-avatar-hint">JPG, PNG under 2MB</p>
      </div>

      <div className="profile-form">
        <div className="profile-field">
          <label>Display Name</label>
          <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} />
        </div>
        <div className="profile-field">
          <label>Email Address</label>
          <input type="email" value={email} disabled className="disabled-input" />
          <span className="field-hint">Email cannot be changed</span>
        </div>
      </div>

      {error && <p className="auth-error">{error}</p>}
      {message && <p className="auth-success">{message}</p>}

      <button className="modal-action-btn" onClick={handleSave} disabled={saving || uploading}>
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
};

export default ProfilePanel;