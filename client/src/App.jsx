import { useState, useEffect, useRef } from 'react';
import AuthScreen from './components/AuthScreen';
import ChatRoom from './components/ChatRoom';
import InstallBanner from './components/InstallBanner';
import useNotifications from './hooks/useNotifications';
import { socket } from './socket';

// ── Cookie helpers ────────────────────────────────────────────────
function setCookie(name, value, days = 30) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function getCookie(name) {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function deleteCookie(name) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

function saveSession(userData) {
  setCookie('chaat_user', JSON.stringify(userData));
  // keep localStorage as a fallback for browsers that block cookies
  try { localStorage.setItem('chaat_user', JSON.stringify(userData)); } catch {}
}

function loadSession() {
  const fromCookie = getCookie('chaat_user');
  if (fromCookie) {
    try { return JSON.parse(fromCookie); } catch {}
  }
  const fromStorage = localStorage.getItem('chaat_user');
  if (fromStorage) {
    try { return JSON.parse(fromStorage); } catch {}
  }
  return null;
}

function clearSession() {
  deleteCookie('chaat_user');
  try { localStorage.removeItem('chaat_user'); } catch {}
}

export default function App() {
  const [user, setUser] = useState(null);
  const userRef = useRef(null);

  const {
    permission,
    isStandalone,
    isIOS,
    pushSupported,
    requestPermission,
    showLocalNotification,
    unsubscribe
  } = useNotifications(user?.username);

  // Restore session on load
  useEffect(() => {
    const saved = loadSession();
    if (saved) {
      setUser(saved);
      userRef.current = saved;
      socket.connect();
      socket.once('connect', () => {
        socket.emit('join', saved);
      });
    }
  }, []);

  // Re-join after reconnections (socket auto-reconnect loses server state)
  useEffect(() => {
    function onReconnect() {
      if (userRef.current) {
        socket.emit('join', userRef.current);
      }
    }
    socket.on('connect', onReconnect);
    return () => socket.off('connect', onReconnect);
  }, []);

  // Prompt for notification permission after login
  useEffect(() => {
    if (user && permission === 'default') {
      const timer = setTimeout(() => {
        requestPermission();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [user, permission, requestPermission]);

  function handleAuth(userData) {
    saveSession(userData);
    setUser(userData);
    userRef.current = userData;
    socket.emit('join', userData);
  }

  function handleAvatarUpdate(dataUrl) {
    const updated = { ...user, avatarUrl: dataUrl };
    setUser(updated);
    userRef.current = updated;
    saveSession(updated);
  }

  function handleLogout() {
    unsubscribe();
    clearSession();
    socket.disconnect();
    setUser(null);
    userRef.current = null;
  }

  if (!user) return <AuthScreen onAuth={handleAuth} />;

  return (
    <>
      <ChatRoom
        username={user.username}
        avatarUrl={user.avatarUrl}
        onAvatarUpdate={handleAvatarUpdate}
        onLogout={handleLogout}
        showLocalNotification={showLocalNotification}
        notifPermission={permission}
        requestPermission={requestPermission}
      />
      <InstallBanner isIOS={isIOS} isStandalone={isStandalone} />
    </>
  );
}
