import { useState, useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import EmojiButton from './EmojiButton';

export default function DMPanel({ 
  targetUser, 
  onClose, 
  messages = [], 
  onSendMessage, 
  currentUser 
}) {
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  const avatarUrl = targetUser?.avatarUrl || 
    `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(targetUser?.username || '')}`;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!input.trim()) return;
    onSendMessage(input.trim(), 'dm');
    setInput('');
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("File size exceeds 5MB limit.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      onSendMessage({
        type: file.type.startsWith('image/') ? 'image' : 'file',
        data: reader.result,
        filename: file.name
      }, 'image');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  return (
    <div className="glass-panel dm-panel" style={{
      position: 'fixed',
      top: '60px',
      right: 0,
      width: '360px',
      height: 'calc(100vh - 60px)',
      zIndex: 40,
      display: 'flex',
      flexDirection: 'column',
      borderRight: 'none',
      borderBottom: 'none',
      borderRadius: '16px 0 0 0',
      boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.2)',
      animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
    }}>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>

      {/* Headerbar */}
      <div className="flex-between" style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-color)',
        background: 'var(--glass-bg)'
      }}>
        <div className="flex-center" style={{ gap: '10px' }}>
          <span style={{ fontWeight: 600, fontSize: '1rem' }}>
            Private DM
          </span>
        </div>

        <button 
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: '1.2rem',
            cursor: 'pointer',
            padding: '2px 6px'
          }}
        >
          ✕
        </button>
      </div>

      {/* Prominent Profile Header containing the 64px DiceBear avatar */}
      <div className="flex-center" style={{
        flexDirection: 'column',
        padding: '20px 16px',
        borderBottom: '1px solid var(--border-color)',
        gap: '8px'
      }}>
        <img 
          src={avatarUrl} 
          alt={targetUser?.username} 
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            objectFit: 'cover',
            border: '2px solid rgba(255,255,255,0.2)'
          }} 
        />
        <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>
          {targetUser?.username}
        </span>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          This is the start of your private direct message history with {targetUser?.username}.
        </span>
      </div>

      {/* Message List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {messages.map((msg, i) => (
          <MessageBubble 
            key={i} 
            message={msg} 
            currentUser={currentUser} 
            isDm={true} 
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex-center" style={{
        padding: '12px',
        borderTop: '1px solid var(--border-color)',
        gap: '8px',
        background: 'var(--surface-base)'
      }}>
        {/* Paperclip button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Attach Image/File"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
          </svg>
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          style={{ display: 'none' }} 
          accept="image/*"
        />

        {/* Emoji Button */}
        <EmojiButton onSelect={emoji => setInput(prev => prev + emoji)} />

        <input
          type="text"
          placeholder={`Message @${targetUser?.username}`}
          value={input}
          onChange={e => setInput(e.target.value)}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            background: 'transparent',
            color: 'var(--text-main)',
            outline: 'none',
            fontSize: '0.9rem'
          }}
          onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px rgba(99,102,241,0.5)'}
          onBlur={e => e.currentTarget.style.boxShadow = 'none'}
        />

        <button
          type="submit"
          style={{
            background: 'var(--accent-dm)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            width: '34px',
            height: '34px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1rem'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          ➤
        </button>
      </form>
    </div>
  );
}
