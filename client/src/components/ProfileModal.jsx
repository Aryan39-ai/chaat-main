import { useRef, useEffect } from 'react';
import { socket } from '../socket';

export default function ProfileModal({ username, avatarUrl, onClose, onAvatarUpdate }) {
  const fileInputRef = useRef(null);
  const overlayRef = useRef(null);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return alert('Please select an image file.');
    if (file.size > 2 * 1024 * 1024) return alert('Image must be under 2MB.');

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      socket.emit('update_avatar', dataUrl);
      onAvatarUpdate(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
    onClose();
  }

  return (
    <div
      ref={overlayRef}
      className="profile-overlay"
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="glass-panel profile-modal animate-slide-up">
        {/* Header */}
        <div className="profile-header">
          <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>Your Profile</span>
          <button onClick={onClose} className="profile-close-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Avatar */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '28px 24px' }}>
          <div className="profile-avatar-wrap" onClick={() => fileInputRef.current?.click()}>
            <img
              src={avatarUrl}
              alt={username}
              className="profile-avatar-img"
            />
            <div className="profile-avatar-overlay">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Change</span>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          <div style={{ textAlign: 'center' }}>
            <p style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: '4px' }}>{username}</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Online</p>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="profile-upload-btn"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
            Upload New Photo
          </button>

          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            JPG, PNG or GIF · Max 2MB
          </p>
        </div>
      </div>
    </div>
  );
}
