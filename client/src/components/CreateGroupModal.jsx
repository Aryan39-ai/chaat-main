import { useState, useRef, useEffect } from 'react';

export default function CreateGroupModal({ onClose, onCreate, onlineUsers = [], currentUser }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [password, setPassword] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [inviteInput, setInviteInput] = useState('');
  const [inviteList, setInviteList] = useState([]);
  const [error, setError] = useState('');
  const overlayRef = useRef(null);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const otherUsers = onlineUsers.filter(u => u.username !== currentUser);

  function addInvite() {
    const trimmed = inviteInput.trim();
    if (!trimmed) return;
    if (inviteList.includes(trimmed)) return setError(`${trimmed} already added.`);
    setInviteList(prev => [...prev, trimmed]);
    setInviteInput('');
    setError('');
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return setError('Group name is required.');
    if (usePassword && !password.trim()) return setError('Enter a password or disable password protection.');
    onCreate({ name: name.trim(), description: description.trim(), password: usePassword ? password : '', inviteList });
    onClose();
  }

  return (
    <div ref={overlayRef} className="profile-overlay" onClick={e => { if (e.target === overlayRef.current) onClose(); }}>
      <div className="glass-panel animate-slide-up" style={{ width: '100%', maxWidth: '460px', borderRadius: '24px', overflow: 'hidden' }}>

        {/* Header */}
        <div className="profile-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.2rem' }}>🔒</span>
            <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>Create Private Group</span>
          </div>
          <button onClick={onClose} className="profile-close-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Name */}
          <div className="auth-field">
            <label className="auth-label">Group Name</label>
            <input className="auth-input" placeholder="e.g. study-squad" value={name} onChange={e => setName(e.target.value)} maxLength={30} autoFocus />
          </div>

          {/* Description */}
          <div className="auth-field">
            <label className="auth-label">Description <span style={{ opacity: 0.5 }}>(optional)</span></label>
            <input className="auth-input" placeholder="What's this group about?" value={description} onChange={e => setDescription(e.target.value)} maxLength={80} />
          </div>

          {/* Password toggle */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
              <div
                onClick={() => setUsePassword(v => !v)}
                style={{
                  width: '40px', height: '22px', borderRadius: '11px',
                  background: usePassword ? 'var(--accent-solid)' : 'var(--border-color)',
                  position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                  border: '1px solid var(--border-color)'
                }}
              >
                <div style={{
                  position: 'absolute', top: '2px',
                  left: usePassword ? '19px' : '2px',
                  width: '16px', height: '16px', borderRadius: '50%',
                  background: 'white', transition: 'left 0.2s',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.2)'
                }} />
              </div>
              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>Password-protected</span>
            </label>

            {usePassword && (
              <input
                className="auth-input"
                type="password"
                placeholder="Group password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            )}

            {!usePassword && (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '-4px' }}>
                Invite-only — only users you add can join.
              </p>
            )}
          </div>

          {/* Invite users */}
          <div className="auth-field">
            <label className="auth-label">Invite Members <span style={{ opacity: 0.5 }}>(optional)</span></label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                className="auth-input"
                placeholder="Type a username"
                value={inviteInput}
                onChange={e => setInviteInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addInvite(); } }}
                list="online-users-list"
                style={{ flex: 1 }}
              />
              <datalist id="online-users-list">
                {otherUsers.map(u => <option key={u.username} value={u.username} />)}
              </datalist>
              <button type="button" onClick={addInvite} className="profile-upload-btn" style={{ padding: '0 16px', flexShrink: 0, boxShadow: 'none' }}>
                Add
              </button>
            </div>

            {inviteList.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                {inviteList.map(u => (
                  <span key={u} className="invite-tag">
                    {u}
                    <button type="button" onClick={() => setInviteList(prev => prev.filter(x => x !== u))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: '0 0 0 4px', lineHeight: 1 }}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {error && <div className="auth-error"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{error}</div>}

          <button type="submit" className="auth-submit" style={{ marginTop: '4px' }}>
            Create Group →
          </button>
        </form>
      </div>
    </div>
  );
}
