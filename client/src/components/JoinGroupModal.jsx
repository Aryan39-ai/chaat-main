import { useState, useRef, useEffect } from 'react';

export default function JoinGroupModal({ onClose, onJoin }) {
  const [groupName, setGroupName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const overlayRef = useRef(null);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Listen for group errors forwarded from parent
  useEffect(() => {
    const handler = e => setError(e.detail);
    window.addEventListener('group_error', handler);
    return () => window.removeEventListener('group_error', handler);
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!groupName.trim()) return setError('Enter the group name.');
    let name = groupName.trim();
    if (!name.startsWith('#')) name = '#' + name;
    onJoin({ roomName: name, password });
  }

  return (
    <div ref={overlayRef} className="profile-overlay" onClick={e => { if (e.target === overlayRef.current) onClose(); }}>
      <div className="glass-panel animate-slide-up" style={{ width: '100%', maxWidth: '380px', borderRadius: '24px', overflow: 'hidden' }}>

        <div className="profile-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.2rem' }}>🔑</span>
            <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>Join Private Group</span>
          </div>
          <button onClick={onClose} className="profile-close-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '-4px' }}>
            Enter the exact group name and password (if required) to join.
          </p>

          <div className="auth-field">
            <label className="auth-label">Group Name</label>
            <input className="auth-input" placeholder="#group-name" value={groupName} onChange={e => setGroupName(e.target.value)} autoFocus />
          </div>

          <div className="auth-field">
            <label className="auth-label">Password <span style={{ opacity: 0.5 }}>(if required)</span></label>
            <input className="auth-input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
          </div>

          {error && (
            <div className="auth-error">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          <button type="submit" className="auth-submit">Join Group →</button>
        </form>
      </div>
    </div>
  );
}
