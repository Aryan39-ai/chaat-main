import { useState, useEffect } from 'react';

export default function Topbar({ currentRoom, onlineCount, username, avatarUrl, onOpenProfile, onLogout }) {
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('soundEnabled');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    localStorage.setItem('soundEnabled', soundEnabled.toString());
    window.__soundEnabled = soundEnabled;
  }, [soundEnabled]);

  return (
    <div className="glass-panel topbar">
      {/* Left: avatar + room name */}
      <div className="flex-center" style={{ gap: '12px' }}>
        {avatarUrl && (
          <button onClick={onOpenProfile} className="topbar-avatar-btn" title="Edit profile">
            <img src={avatarUrl} alt={username} className="topbar-avatar" />
            <span className="topbar-avatar-dot" />
          </button>
        )}
        <div className="flex-center" style={{ gap: '8px' }}>
          <span style={{ fontSize: '1rem', fontWeight: 700 }}>{currentRoom || 'Chat'}</span>
          {onlineCount !== undefined && (
            <span className="online-pill">{onlineCount} online</span>
          )}
        </div>
      </div>

      {/* Right: controls */}
      <div className="flex-center" style={{ gap: '8px' }}>
        <button
          onClick={() => setSoundEnabled(v => !v)}
          title={soundEnabled ? 'Mute notifications' : 'Unmute notifications'}
          className={`topbar-btn${soundEnabled ? ' active-teal' : ''}`}
        >
          {soundEnabled ? (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          ) : (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <line x1="2" y1="2" x2="22" y2="22"/>
            </svg>
          )}
        </button>

        <button
          onClick={() => setIsDark(v => !v)}
          title={isDark ? 'Light mode' : 'Dark mode'}
          className="topbar-btn"
        >
          {isDark ? (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          ) : (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
        </button>

        {onLogout && (
          <button onClick={onLogout} title="Sign out" className="topbar-btn topbar-logout">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
