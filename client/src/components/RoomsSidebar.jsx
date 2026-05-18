import { useState } from 'react';

function RoomButton({ room, isActive, unread, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`room-btn${isActive ? ' active' : ''}`}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {room}
      </span>
      {unread > 0 && !isActive && (
        <span className="room-unread-badge">{unread > 99 ? '99+' : unread}</span>
      )}
    </button>
  );
}

function GroupButton({ group, isActive, unread, currentUser, onClick, onInvite, onKick }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isAdmin = group.isAdmin;

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={onClick}
        className={`room-btn${isActive ? ' active' : ''}`}
        style={{ paddingRight: isAdmin ? '32px' : undefined }}
      >
        <span style={{ fontSize: '0.85rem', flexShrink: 0, opacity: 0.7 }}>🔒</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {group.name}
        </span>
        {unread > 0 && !isActive && (
          <span className="room-unread-badge">{unread > 99 ? '99+' : unread}</span>
        )}
      </button>

      {isAdmin && (
        <div style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', zIndex: 2 }}>
          <button
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
            className="group-admin-btn"
            title="Manage group"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
          </button>

          {menuOpen && (
            <div className="group-menu glass-panel" onClick={e => e.stopPropagation()}>
              <button className="group-menu-item" onClick={() => { onInvite(group); setMenuOpen(false); }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                Invite User
              </button>
              <button className="group-menu-item danger" onClick={() => { onKick(group); setMenuOpen(false); }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                Kick Member
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function RoomsSidebar({
  roomsList = [],
  privateGroups = [],
  currentRoom,
  currentUser,
  onJoinRoom,
  onCreateRoom,
  onCreateGroup,
  onJoinGroup,
  onInviteToGroup,
  onKickFromGroup,
  unreadCounts = {},
  mobileOpen = false
}) {
  return (
    <div className={`glass-panel desktop-only mobile-drawer${mobileOpen ? ' open' : ''}`} style={{
      width: '220px',
      height: 'calc(100vh - 60px)',
      borderTop: 'none',
      borderLeft: 'none',
      borderBottom: 'none',
      borderRadius: 0,
      padding: '16px 10px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      overflowY: 'auto',
      flexShrink: 0
    }}>

      {/* ── Channels ── */}
      <div className="sidebar-section-header">
        <span>Channels</span>
        <button
          onClick={() => {
            const name = prompt('New channel name:');
            if (name?.trim()) onCreateRoom(name.trim());
          }}
          className="sidebar-add-btn"
          title="Create channel"
        >+</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '8px' }}>
        {roomsList.map(room => (
          <RoomButton
            key={room}
            room={room}
            isActive={room === currentRoom}
            unread={unreadCounts[room] || 0}
            onClick={() => onJoinRoom(room)}
          />
        ))}
      </div>

      {/* ── Private Groups ── */}
      <div className="sidebar-section-header" style={{ marginTop: '4px' }}>
        <span>Private Groups</span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={onJoinGroup} className="sidebar-add-btn" title="Join a group">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
          </button>
          <button onClick={onCreateGroup} className="sidebar-add-btn" title="Create group">+</button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {privateGroups.length === 0 ? (
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '6px 10px', lineHeight: 1.5 }}>
            No groups yet. Create one or ask to be invited.
          </p>
        ) : (
          privateGroups.map(group => (
            <GroupButton
              key={group.name}
              group={group}
              isActive={group.name === currentRoom}
              unread={unreadCounts[group.name] || 0}
              currentUser={currentUser}
              onClick={() => onJoinRoom(group.name)}
              onInvite={onInviteToGroup}
              onKick={onKickFromGroup}
            />
          ))
        )}
      </div>
    </div>
  );
}
