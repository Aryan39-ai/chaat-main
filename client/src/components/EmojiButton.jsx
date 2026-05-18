import { useState, useRef, useEffect } from 'react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

export default function EmojiButton({ onSelect }) {
  const [show, setShow] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShow(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <button
        type="button"
        onClick={() => setShow(!show)}
        title="Choose Emoji"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-main)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
          <line x1="9" y1="9" x2="9.01" y2="9"></line>
          <line x1="15" y1="9" x2="15.01" y2="9"></line>
        </svg>
      </button>

      {show && (
        <div style={{
          position: 'absolute',
          bottom: '40px',
          left: 0,
          zIndex: 50,
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          borderRadius: '12px',
          overflow: 'hidden'
        }}>
          <Picker 
            data={data} 
            onEmojiSelect={(emoji) => {
              onSelect(emoji.native);
              setShow(false);
            }} 
            theme={document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'}
          />
        </div>
      )}
    </div>
  );
}
