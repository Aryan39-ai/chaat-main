import { useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

export default function MessageBubble({ message, currentUser, isDm = false }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (!message) return null;

  if (message.type === 'system') {
    return (
      <div className="animate-slide-up" style={{
        textAlign: 'center',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        margin: '8px 0'
      }}>
        {message.text}
      </div>
    );
  }

  const isMe = message.fromUsername === currentUser || message.username === currentUser;
  
  let bubbleClass = "glass-bubble-other";
  if (isMe) {
    bubbleClass = isDm ? "glass-bubble-dm" : "glass-bubble-mine";
  }

  let rawMarkup = "";
  if (message.text) {
    try {
      rawMarkup = DOMPurify.sanitize(marked.parse(message.text, { breaks: true }));
    } catch (e) {
      rawMarkup = DOMPurify.sanitize(message.text);
    }
  }

  function formatTime(isoOrDate) {
    if (!isoOrDate) return '';
    return new Date(isoOrDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const avatarUrl = message.avatarUrl || 
    `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(message.fromUsername || message.username || '')}`;

  return (
    <div className="animate-slide-up" style={{
      display: 'flex',
      gap: '12px',
      alignItems: 'flex-start',
      flexDirection: isMe ? 'row-reverse' : 'row'
    }}>
      <style>{`
        .markdown-content p {
          margin: 0;
        }
        .markdown-content a {
          color: inherit;
          text-decoration: underline;
        }
        .markdown-content code {
          font-family: monospace;
          background: rgba(0, 0, 0, 0.25);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.85em;
        }
        .markdown-content pre {
          background: rgba(0, 0, 0, 0.3);
          padding: 8px;
          border-radius: 8px;
          overflow-x: auto;
          margin: 4px 0;
        }
        .markdown-content pre code {
          background: transparent;
          padding: 0;
        }
      `}</style>

      {/* Avatar */}
      <img 
        src={avatarUrl} 
        alt={message.fromUsername || message.username}
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          objectFit: 'cover',
          border: '2px solid rgba(255,255,255,0.2)',
          flexShrink: 0
        }}
      />

      {/* Content wrapper */}
      <div style={{ maxWidth: '75%' }}>
        <div 
          className={bubbleClass}
          style={{
            padding: '10px 14px',
            borderRadius: isMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
            fontSize: '0.95rem',
            lineHeight: 1.4,
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            wordBreak: 'break-word'
          }}
        >
          {/* Render image if present */}
          {(message.type === 'image' || message.imageData) && (
            <div style={{ margin: message.text ? '0 0 8px 0' : 0 }}>
              <img 
                src={message.imageData} 
                alt={message.text || "Uploaded attachment"}
                onClick={() => setLightboxOpen(true)}
                style={{
                  maxWidth: '240px',
                  width: '100%',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'block',
                  objectFit: 'cover',
                  maxHeight: '200px'
                }}
              />
            </div>
          )}

          {/* Render markdown text */}
          {rawMarkup && (
            <div 
              className="markdown-content"
              dangerouslySetInnerHTML={{ __html: rawMarkup }} 
            />
          )}
        </div>

        {/* Meta info */}
        <div style={{
          fontSize: '0.7rem',
          color: 'var(--text-muted)',
          marginTop: '4px',
          textAlign: isMe ? 'right' : 'left',
          padding: '0 4px'
        }}>
          {isMe ? 'you' : (message.fromUsername || message.username)} · {formatTime(message.timestamp)}
        </div>
      </div>

      {/* Lightbox full-screen overlay */}
      {lightboxOpen && (
        <div 
          onClick={() => setLightboxOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            cursor: 'zoom-out'
          }}
        >
          <img 
            src={message.imageData} 
            alt="Expanded full screen"
            style={{
              maxWidth: '90%',
              maxHeight: '90%',
              objectFit: 'contain',
              borderRadius: '12px',
              boxShadow: '0 12px 48px rgba(0,0,0,0.5)'
            }}
          />
        </div>
      )}
    </div>
  );
}
