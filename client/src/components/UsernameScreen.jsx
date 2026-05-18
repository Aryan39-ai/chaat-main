import { useState } from 'react';

export default function UsernameScreen({ onJoin }) {
  const [name, setName] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (name.trim()) onJoin(name.trim());
  }

  return (
    <div className="animated-bg flex-center" style={{ padding: '24px' }}>
      <div className="glass-panel animate-slide-up" style={{
        padding: '2.5rem 3rem',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '400px',
        textAlign: 'center',
        boxShadow: '0 20px 50px rgba(0,0,0,0.15)'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'var(--accent-mine)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.8rem',
          margin: '0 auto 1rem auto',
          boxShadow: '0 8px 20px rgba(99,102,241,0.4)'
        }}>
          💬
        </div>

        <h1 style={{
          fontSize: '1.8rem',
          fontWeight: 700,
          marginBottom: '0.4rem',
          letterSpacing: '-0.02em'
        }}>
          Welcome to Chaat
        </h1>

        <p style={{
          color: 'var(--text-muted)',
          fontSize: '0.95rem',
          marginBottom: '2rem'
        }}>
          Premium real-time messaging
        </p>

        <form onSubmit={handleSubmit} style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          <input
            type="text"
            placeholder="Enter your username"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={20}
            autoFocus
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              background: 'var(--surface-base)',
              color: 'var(--text-main)',
              fontSize: '1rem',
              outline: 'none',
              textAlign: 'center',
              fontWeight: 500
            }}
            onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px rgba(99,102,241,0.5)'}
            onBlur={e => e.currentTarget.style.boxShadow = 'none'}
          />

          <button
            type="submit"
            disabled={!name.trim()}
            style={{
              padding: '12px',
              background: 'var(--accent-mine)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: name.trim() ? 'pointer' : 'not-allowed',
              opacity: name.trim() ? 1 : 0.5,
              boxShadow: name.trim() ? '0 8px 20px rgba(99,102,241,0.3)' : 'none'
            }}
            onMouseEnter={e => {
              if (name.trim()) e.currentTarget.style.transform = 'scale(1.03)';
            }}
            onMouseLeave={e => {
              if (name.trim()) e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            Join Workspace →
          </button>
        </form>
      </div>
    </div>
  );
}
