import { useState, useEffect } from 'react';
import { socket } from '../socket';

export default function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    socket.on('auth_success', (data) => {
      setLoading(false);
      setConnecting(false);
      onAuth(data);
    });
    socket.on('auth_error', (msg) => {
      setLoading(false);
      setConnecting(false);
      setError(msg);
    });
    socket.on('connect_error', () => {
      setLoading(false);
      setConnecting(false);
      setError('Cannot reach server. Please try again.');
    });
    return () => {
      socket.off('auth_success');
      socket.off('auth_error');
      socket.off('connect_error');
    };
  }, [onAuth]);

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) return setError('Please fill in all fields.');
    if (mode === 'register') {
      if (password.length < 4) return setError('Password must be at least 4 characters.');
      if (password !== confirm) return setError('Passwords do not match.');
    }
    setLoading(true);

    if (socket.connected) {
      socket.emit(mode, { username: username.trim(), password });
    } else {
      setConnecting(true);
      socket.connect();
      socket.once('connect', () => {
        setConnecting(false);
        socket.emit(mode, { username: username.trim(), password });
      });
    }
  }

  const isRegister = mode === 'register';

  return (
    <div className="animated-bg flex-center auth-bg" style={{ minHeight: '100vh', padding: '20px' }}>
      <div className="glass-panel auth-card animate-slide-up">

        {/* Logo / brand */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div className="auth-logo">💬</div>
          <h1 className="auth-title">Chaat</h1>
          <p className="auth-sub">Real-time messaging, reimagined</p>
        </div>

        {/* Tab switcher */}
        <div className="auth-tabs">
          <button
            className={`auth-tab${!isRegister ? ' active' : ''}`}
            onClick={() => { setMode('login'); setError(''); }}
            type="button"
          >
            Sign In
          </button>
          <button
            className={`auth-tab${isRegister ? ' active' : ''}`}
            onClick={() => { setMode('register'); setError(''); }}
            type="button"
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="auth-field">
            <label className="auth-label">Username</label>
            <input
              type="text"
              placeholder="e.g. coolcat42"
              value={username}
              onChange={e => setUsername(e.target.value)}
              maxLength={20}
              autoFocus
              autoComplete="username"
              className="auth-input"
            />
          </div>

          <div className="auth-field">
            <label className="auth-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                className="auth-input"
                style={{ paddingRight: '44px' }}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="auth-pw-toggle"
                tabIndex={-1}
              >
                {showPw ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>

          {isRegister && (
            <div className="auth-field">
              <label className="auth-label">Confirm Password</label>
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="••••••••"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                autoComplete="new-password"
                className="auth-input"
              />
            </div>
          )}

          {error && (
            <div className="auth-error">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="auth-submit"
          >
            {connecting ? 'Connecting…' : loading ? (
              <span className="auth-spinner" />
            ) : (
              isRegister ? 'Create Account →' : 'Sign In →'
            )}
          </button>
        </form>

        <p className="auth-switch">
          {isRegister ? 'Already have an account? ' : "Don't have an account? "}
          <button
            type="button"
            onClick={() => { setMode(isRegister ? 'login' : 'register'); setError(''); }}
            className="auth-switch-btn"
          >
            {isRegister ? 'Sign In' : 'Create one'}
          </button>
        </p>
      </div>
    </div>
  );
}
