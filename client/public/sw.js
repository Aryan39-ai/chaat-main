// ─── Chaat Service Worker ─────────────────────────────────────────
// Handles Web Push notifications and notification click routing.

const CACHE_NAME = 'chaat-v1';
const OFFLINE_ASSETS = ['/', '/index.html'];

// ── Install: pre-cache the app shell for offline splash ──────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_ASSETS))
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ───────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Push: receive server-sent push payloads ──────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'Chaat', body: 'You have a new message', icon: '/icons/icon-192.png', url: '/' };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192.png',
    badge: '/icons/icon-96.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: 'Open Chaat' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    tag: data.tag || 'chaat-notification',
    renotify: true
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// ── Notification Click: focus or open the app window ─────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If an existing window is open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NOTIFICATION_CLICK', url: targetUrl });
          return;
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow(targetUrl);
    })
  );
});

// ── Fetch: network-first with offline fallback ───────────────────
self.addEventListener('fetch', (event) => {
  // Only handle same-origin navigation requests
  if (event.request.mode !== 'navigate') return;

  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match('/index.html')
    )
  );
});
