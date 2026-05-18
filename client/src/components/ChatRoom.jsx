import { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';
import Topbar from './Topbar';
import RoomsSidebar from './RoomsSidebar';
import DMPanel from './DMPanel';
import MessageBubble from './MessageBubble';
import EmojiButton from './EmojiButton';
import ProfileModal from './ProfileModal';
import CreateGroupModal from './CreateGroupModal';
import JoinGroupModal from './JoinGroupModal';

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {
    console.error("AudioContext notification error:", e);
  }
}

export default function ChatRoom({ username, avatarUrl, onAvatarUpdate, onLogout, showLocalNotification, notifPermission, requestPermission }) {
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [roomsList, setRoomsList] = useState([]);
  const [currentRoom, setCurrentRoom] = useState('#general');
  const [input, setInput] = useState('');
  const [typers, setTypers] = useState([]);
  const [unreadRoomCounts, setUnreadRoomCounts] = useState({});
  const [unreadDmCounts, setUnreadDmCounts] = useState({});
  const [dmPanelUser, setDmPanelUser] = useState(null);
  const [dmMessagesMap, setDmMessagesMap] = useState({});
  const [hoveredUser, setHoveredUser] = useState(null);
  const [mobilePanel, setMobilePanel] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [privateGroups, setPrivateGroups] = useState([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showJoinGroup, setShowJoinGroup] = useState(false);
  const [groupNotif, setGroupNotif] = useState(null); // { groupName, invitedBy }

  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeout = useRef(null);

  const currentRoomRef = useRef(currentRoom);
  useEffect(() => { currentRoomRef.current = currentRoom; }, [currentRoom]);

  const dmPanelUserRef = useRef(dmPanelUser);
  useEffect(() => { dmPanelUserRef.current = dmPanelUser; }, [dmPanelUser]);

  useEffect(() => {
    socket.on('rooms_list', (list) => {
      setRoomsList(list);
    });

    socket.on('new_room', (roomName) => {
      setRoomsList(prev => [...new Set([...prev, roomName])]);
    });

    socket.on('history', (history) => {
      setMessages(history);
    });

    socket.on('room_history', (history) => {
      setMessages(history);
    });

    socket.on('online_users', (list) => {
      setUsers(list);
    });

    socket.on('user_joined', ({ username: who, users: list }) => {
      setUsers(list);
      setMessages(prev => [...prev, { type: 'system', text: `${who} joined the workspace` }]);
    });

    socket.on('user_left', ({ username: who, users: list }) => {
      setUsers(list);
      setMessages(prev => [...prev, { type: 'system', text: `${who} left the workspace` }]);
    });

    socket.on('message', (msg) => {
      const activeRoom = currentRoomRef.current;
      if (msg.room === activeRoom) {
        setMessages(prev => [...prev, msg]);
      } else {
        setUnreadRoomCounts(prev => ({
          ...prev,
          [msg.room]: (prev[msg.room] || 0) + 1
        }));
      }

      const isOtherRoom = msg.room !== currentRoomRef.current;
      if ((document.hidden || isOtherRoom) && msg.fromUsername !== username && window.__soundEnabled !== false) {
        playNotificationSound();
        // Trigger native OS notification banner only when tab is hidden
        if (document.hidden && showLocalNotification) {
          const preview = msg.type === 'image' ? '📷 Image' : (msg.text || '').slice(0, 100);
          showLocalNotification(
            `${msg.fromUsername} in ${msg.room}`,
            preview,
            msg.avatarUrl
          );
        }
      }
    });

    socket.on('receive_dm', (dmObj) => {
      const activeDmUser = dmPanelUserRef.current?.username;
      const otherUser = dmObj.fromUsername === username ? dmObj.toUsername : dmObj.fromUsername;

      setDmMessagesMap(prev => ({
        ...prev,
        [otherUser]: [...(prev[otherUser] || []), dmObj]
      }));

      if (activeDmUser !== otherUser && dmObj.fromUsername !== username) {
        setUnreadDmCounts(prev => ({
          ...prev,
          [dmObj.fromUsername]: (prev[dmObj.fromUsername] || 0) + 1
        }));
      }

      const isDmPanelOpen = dmPanelUserRef.current?.username === dmObj.fromUsername;
      if ((document.hidden || !isDmPanelOpen) && dmObj.fromUsername !== username && window.__soundEnabled !== false) {
        playNotificationSound();
        if (document.hidden && showLocalNotification) {
          const preview = dmObj.type === 'image' ? '📷 Image' : (dmObj.text || '').slice(0, 100);
          showLocalNotification(
            `DM from ${dmObj.fromUsername}`,
            preview,
            dmObj.avatarUrl
          );
        }
      }
    });

    socket.on('dm_history', ({ targetUsername, messages: history }) => {
      setDmMessagesMap(prev => ({ ...prev, [targetUsername]: history }));
    });

    socket.on('typing', ({ username: who, isTyping }) => {
      setTypers(prev =>
        isTyping ? [...new Set([...prev, who])] : prev.filter(u => u !== who)
      );
    });

    socket.on('avatar_updated', ({ username: who, avatarUrl: newAvatar }) => {
      setUsers(prev => prev.map(u =>
        u.username === who ? { ...u, avatarUrl: newAvatar } : u
      ));
    });

    socket.on('private_groups_list', (groups) => {
      setPrivateGroups(groups);
    });

    socket.on('group_invite', ({ groupName, invitedBy }) => {
      setGroupNotif({ groupName, invitedBy });
      socket.emit('get_private_groups');
    });

    socket.on('group_created', ({ name }) => {
      handleJoinRoom(name);
    });

    socket.on('group_error', (msg) => {
      window.dispatchEvent(new CustomEvent('group_error', { detail: msg }));
      alert(msg);
    });

    socket.on('kicked_from_group', ({ groupName }) => {
      setPrivateGroups(prev => prev.filter(g => g.name !== groupName));
      if (currentRoomRef.current === groupName) {
        setCurrentRoom('#general');
        socket.emit('join_room', '#general');
      }
      alert(`You were removed from ${groupName}.`);
    });

    return () => {
      socket.off('rooms_list');
      socket.off('new_room');
      socket.off('history');
      socket.off('room_history');
      socket.off('online_users');
      socket.off('user_joined');
      socket.off('user_left');
      socket.off('message');
      socket.off('receive_dm');
      socket.off('dm_history');
      socket.off('typing');
      socket.off('avatar_updated');
      socket.off('private_groups_list');
      socket.off('group_invite');
      socket.off('group_created');
      socket.off('group_error');
      socket.off('kicked_from_group');
    };
  }, [username]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typers]);

  function handleJoinRoom(roomName) {
    setCurrentRoom(roomName);
    socket.emit('join_room', roomName);
    setUnreadRoomCounts(prev => ({ ...prev, [roomName]: 0 }));
    setMobilePanel(null);
  }

  function handleCreateGroup({ name, description, password, inviteList }) {
    socket.emit('create_group', { name, description, password, inviteList });
  }

  function handleJoinPrivateGroup({ roomName, password }) {
    socket.emit('join_private_group', { roomName, password });
    setShowJoinGroup(false);
  }

  function handleInviteToGroup(group) {
    const targetUsername = prompt(`Invite someone to ${group.name}:\nEnter their username:`);
    if (targetUsername?.trim()) {
      socket.emit('invite_to_group', { roomName: group.name, targetUsername: targetUsername.trim() });
    }
  }

  function handleKickFromGroup(group) {
    const targetUsername = prompt(`Kick a member from ${group.name}:\nEnter their username:`);
    if (targetUsername?.trim()) {
      socket.emit('kick_from_group', { roomName: group.name, targetUsername: targetUsername.trim() });
    }
  }

  function handleOpenDm(targetUserObj) {
    setDmPanelUser(targetUserObj);
    socket.emit('get_dm_history', targetUserObj.username);
    setUnreadDmCounts(prev => ({ ...prev, [targetUserObj.username]: 0 }));
  }

  function handleSendDm(textOrObj, msgType) {
    const targetUserObj = dmPanelUserRef.current;
    if (!targetUserObj) return;

    if (msgType === 'image') {
      socket.emit('send_dm', {
        toUsername: targetUserObj.username,
        type: textOrObj.type,
        data: textOrObj.data,
        filename: textOrObj.filename
      });
    } else {
      socket.emit('send_dm', {
        toUsername: targetUserObj.username,
        text: textOrObj
      });
    }
  }

  function handleSendMessage(e) {
    e.preventDefault();
    if (!input.trim()) return;
    socket.emit('message', input.trim());
    socket.emit('typing', false);
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
      socket.emit('message', {
        type: file.type.startsWith('image/') ? 'image' : 'file',
        data: reader.result,
        filename: file.name
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  return (
    <div className="animated-bg" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Topbar */}
      <Topbar
        currentRoom={currentRoom}
        onlineCount={new Set(users.map(u => u.username)).size}
        username={username}
        avatarUrl={avatarUrl}
        onOpenProfile={() => setShowProfile(true)}
        onLogout={onLogout}
      />

      {/* Main workspace layout row */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Backdrop for mobile drawers */}
        {mobilePanel && (
          <div className="mobile-overlay" onClick={() => setMobilePanel(null)} />
        )}

        {/* Left side rooms channel list */}
        <RoomsSidebar
          roomsList={roomsList}
          privateGroups={privateGroups}
          currentRoom={currentRoom}
          currentUser={username}
          onJoinRoom={handleJoinRoom}
          onCreateRoom={name => socket.emit('create_room', name)}
          onCreateGroup={() => setShowCreateGroup(true)}
          onJoinGroup={() => setShowJoinGroup(true)}
          onInviteToGroup={handleInviteToGroup}
          onKickFromGroup={handleKickFromGroup}
          unreadCounts={unreadRoomCounts}
          mobileOpen={mobilePanel === 'sidebar'}
        />

        {/* Center Messages streaming canvas */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(10px)',
          borderLeft: '1px solid var(--border-color)',
          borderRight: '1px solid var(--border-color)',
          overflow: 'hidden'
        }}>
          {/* Messages Stream */}
          <div className="messages-area" style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} currentUser={username} />
            ))}

            {typers.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  {typers.join(', ')} {typers.length === 1 ? 'is' : 'are'} typing...
                </span>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input Bar Form */}
          <form className="input-bar" onSubmit={handleSendMessage} style={{
            padding: '12px 20px',
            background: 'var(--surface-base)',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            {/* Paperclip Upload Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Upload Image/File"
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

            {/* Emoji Popover Trigger */}
            <EmojiButton onSelect={emoji => setInput(prev => prev + emoji)} />

            <input
              type="text"
              placeholder={`Message ${currentRoom}`}
              value={input}
              onChange={e => {
                setInput(e.target.value);
                socket.emit('typing', true);
                clearTimeout(typingTimeout.current);
                typingTimeout.current = setTimeout(() => socket.emit('typing', false), 1500);
              }}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                background: 'transparent',
                color: 'var(--text-main)',
                outline: 'none',
                fontSize: '0.95rem'
              }}
              onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px rgba(99,102,241,0.5)'}
              onBlur={e => e.currentTarget.style.boxShadow = 'none'}
              autoFocus
            />

            <button
              type="submit"
              style={{
                background: 'var(--accent-mine)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                width: '38px',
                height: '38px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.1rem'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              ➤
            </button>
          </form>
        </div>

        {/* Right side Online Members panel */}
        <div className={`glass-panel desktop-only mobile-members-drawer${mobilePanel === 'members' ? ' open' : ''}`} style={{
          width: '220px',
          height: 'calc(100vh - 60px)',
          borderTop: 'none',
          borderRight: 'none',
          borderBottom: 'none',
          borderRadius: 0,
          padding: '20px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          overflowY: 'auto',
          flexShrink: 0
        }}>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            padding: '0 8px'
          }}>
            Members — {[...new Map(users.map(u => [u.username, u])).values()].length}
          </span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {[...new Map(users.map(u => [u.username, u])).values()].map(u => {
              const isSelf = u.username === username;
              const isBot = u.username === 'Aria';
              const unreadDm = unreadDmCounts[u.username] || 0;
              const isHovered = hoveredUser === u.username;

              const userAvatar = u.avatarUrl ||
                `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(u.username)}`;

              return (
                <div
                  key={u.username}
                  onMouseEnter={() => setHoveredUser(u.username)}
                  onMouseLeave={() => setHoveredUser(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px',
                    borderRadius: '8px',
                    background: isHovered ? 'var(--glass-bg)' : isBot ? 'rgba(99,102,241,0.08)' : 'transparent',
                    cursor: isSelf ? 'default' : 'pointer',
                    border: isBot ? '1px solid rgba(99,102,241,0.2)' : '1px solid transparent'
                  }}
                >
                  <div className="flex-center" style={{ gap: '10px' }}>
                    <div style={{ position: 'relative' }}>
                      <img
                        src={userAvatar}
                        alt={u.username}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: isBot ? '2px solid rgba(99,102,241,0.6)' : '2px solid rgba(255,255,255,0.2)'
                        }}
                      />
                      {isBot ? (
                        <span style={{
                          position: 'absolute', bottom: 0, right: 0,
                          background: 'var(--accent-mine)', color: 'white',
                          fontSize: '0.5rem', fontWeight: 700,
                          borderRadius: '4px', padding: '0 2px',
                          lineHeight: '10px', height: '10px',
                          border: '1px solid var(--surface-base)'
                        }}>AI</span>
                      ) : (
                        <span className="status-dot-pulse" style={{
                          position: 'absolute', bottom: 0, right: 0,
                          width: '8px', height: '8px', borderRadius: '50%',
                          background: '#22c55e', border: '1px solid var(--surface-base)'
                        }} />
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                      <span style={{
                        fontSize: '0.9rem',
                        fontWeight: 500,
                        color: isBot ? 'var(--accent-mine)' : isSelf ? 'var(--accent-mine)' : 'var(--text-main)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '100px'
                      }}>
                        {u.username} {isSelf && <span style={{fontSize:'0.75rem', opacity:0.6}}>(you)</span>}
                      </span>
                      {isBot && (
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: 1 }}>
                          DM me or @Aria in chat
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Unread DM indicator dot or Hover speech bubble button */}
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {unreadDm > 0 && (
                      <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: '#ef4444',
                        boxShadow: '0 0 6px #ef4444',
                        display: 'inline-block'
                      }} title={`${unreadDm} unread DMs`} />
                    )}

                    {isHovered && !isSelf && (
                      <button
                        onClick={() => handleOpenDm(u)}
                        title={`Send DM to ${u.username}`}
                        style={{
                          background: 'var(--accent-dm)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          width: '24px',
                          height: '24px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginLeft: unreadDm > 0 ? '6px' : 0
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Create group modal */}
        {showCreateGroup && (
          <CreateGroupModal
            onClose={() => setShowCreateGroup(false)}
            onCreate={handleCreateGroup}
            onlineUsers={users}
            currentUser={username}
          />
        )}

        {/* Join group modal */}
        {showJoinGroup && (
          <JoinGroupModal
            onClose={() => setShowJoinGroup(false)}
            onJoin={handleJoinPrivateGroup}
          />
        )}

        {/* Group invite notification */}
        {groupNotif && (
          <div className="group-notif animate-slide-up">
            <span>🔒 <strong>{groupNotif.invitedBy}</strong> invited you to <strong>{groupNotif.groupName}</strong></span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="group-notif-btn accept" onClick={() => { handleJoinRoom(groupNotif.groupName); setGroupNotif(null); }}>Join</button>
              <button className="group-notif-btn" onClick={() => setGroupNotif(null)}>Dismiss</button>
            </div>
          </div>
        )}

        {/* Profile modal */}
        {showProfile && (
          <ProfileModal
            username={username}
            avatarUrl={avatarUrl}
            onClose={() => setShowProfile(false)}
            onAvatarUpdate={(dataUrl) => {
              onAvatarUpdate(dataUrl);
              setShowProfile(false);
            }}
          />
        )}

        {/* Dynamic DM Canvas slide-in overlay */}
        {dmPanelUser && (
          <DMPanel
            targetUser={dmPanelUser}
            onClose={() => setDmPanelUser(null)}
            messages={dmMessagesMap[dmPanelUser.username] || []}
            onSendMessage={handleSendDm}
            currentUser={username}
          />
        )}

        {/* Mobile bottom navigation bar */}
        <nav className="mobile-only mobile-bottom-nav">
          <button
            className={`mobile-nav-btn${mobilePanel === 'sidebar' ? ' active' : ''}`}
            onClick={() => setMobilePanel(p => p === 'sidebar' ? null : 'sidebar')}
          >
            {Object.values(unreadRoomCounts).reduce((a, b) => a + b, 0) > 0 && (
              <span className="badge">{Object.values(unreadRoomCounts).reduce((a, b) => a + b, 0)}</span>
            )}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Channels
          </button>

          <button
            className="mobile-nav-btn active"
            onClick={() => setMobilePanel(null)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Chat
          </button>

          <button
            className={`mobile-nav-btn${mobilePanel === 'members' ? ' active' : ''}`}
            onClick={() => setMobilePanel(p => p === 'members' ? null : 'members')}
          >
            {Object.values(unreadDmCounts).reduce((a, b) => a + b, 0) > 0 && (
              <span className="badge">{Object.values(unreadDmCounts).reduce((a, b) => a + b, 0)}</span>
            )}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Members
          </button>
        </nav>
      </div>
    </div>
  );
}
