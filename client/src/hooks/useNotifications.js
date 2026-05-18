import { useState, useEffect, useCallback, useRef } from 'react';
import { socket } from '../socket';

/**
 * useNotifications — Custom React hook for PWA push notification lifecycle.
 *
 * Handles:
 * 1. Service Worker registration
 * 2. Notification permission requests
 * 3. Push Manager subscription with VAPID keys
 * 4. Sending subscriptions to the backend
 * 5. Local (foreground) notification dispatch
 * 6. PWA standalone mode detection
 */
export default function useNotifications(username) {
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [swRegistration, setSwRegistration] = useState(null);
  const [pushSupported, setPushSupported] = useState(false);
  const subscriptionSent = useRef(false);

  // ── Detect platform & standalone mode ────────────────────────
  useEffect(() => {
    const ua = navigator.userAgent || '';
    const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(ios);

    const standalone =
      window.navigator.standalone === true || // iOS Safari
      window.matchMedia('(display-mode: standalone)').matches || // Chrome / Edge
      window.matchMedia('(display-mode: fullscreen)').matches;
    setIsStandalone(standalone);
  }, []);

  // ── Register Service Worker ──────────────────────────────────
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[SW] Registered:', reg.scope);
        setSwRegistration(reg);
        setPushSupported('PushManager' in window);
      })
      .catch((err) => console.error('[SW] Registration failed:', err));
  }, []);

  // ── Request notification permission ──────────────────────────
  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return 'denied';

    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  // ── Subscribe to Web Push ────────────────────────────────────
  const subscribeToPush = useCallback(async () => {
    if (!swRegistration || !pushSupported || subscriptionSent.current) return;

    try {
      // Fetch VAPID public key from server
      const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
      const res = await fetch(`${serverUrl}/vapid-public-key`);
      if (!res.ok) {
        console.warn('[Push] VAPID key endpoint not available yet');
        return;
      }
      const { publicKey } = await res.json();
      if (!publicKey) return;

      // Convert VAPID key from base64url to Uint8Array
      const applicationServerKey = urlBase64ToUint8Array(publicKey);

      // Check for existing subscription first
      let subscription = await swRegistration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await swRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey
        });
      }

      // Send subscription to server via socket
      socket.emit('push_subscribe', {
        username,
        subscription: subscription.toJSON()
      });

      subscriptionSent.current = true;
      console.log('[Push] Subscribed successfully');
    } catch (err) {
      console.error('[Push] Subscription failed:', err);
    }
  }, [swRegistration, pushSupported, username]);

  // ── Auto-subscribe when permission is granted ────────────────
  useEffect(() => {
    if (permission === 'granted' && swRegistration && username) {
      subscribeToPush();
    }
  }, [permission, swRegistration, username, subscribeToPush]);

  // ── Show a local notification (foreground / minimized tab) ───
  const showLocalNotification = useCallback((title, body, icon) => {
    if (permission !== 'granted') return;

    // Use Service Worker notification if available (works better on mobile)
    if (swRegistration) {
      swRegistration.showNotification(title, {
        body,
        icon: icon || '/icons/icon-192.png',
        badge: '/icons/icon-96.png',
        vibrate: [100, 50, 100],
        tag: 'chaat-local-' + Date.now(),
        renotify: true
      });
    } else if (typeof Notification !== 'undefined') {
      // Fallback to basic Notification API
      new Notification(title, {
        body,
        icon: icon || '/icons/icon-192.png'
      });
    }
  }, [permission, swRegistration]);

  // ── Unsubscribe (on logout) ──────────────────────────────────
  const unsubscribe = useCallback(async () => {
    if (!swRegistration) return;
    try {
      const subscription = await swRegistration.pushManager.getSubscription();
      if (subscription) {
        socket.emit('push_unsubscribe', {
          username,
          endpoint: subscription.endpoint
        });
        await subscription.unsubscribe();
      }
      subscriptionSent.current = false;
    } catch (err) {
      console.error('[Push] Unsubscribe failed:', err);
    }
  }, [swRegistration, username]);

  return {
    permission,
    isStandalone,
    isIOS,
    pushSupported,
    requestPermission,
    subscribeToPush,
    showLocalNotification,
    unsubscribe
  };
}

// ── Helper: Convert base64url-encoded VAPID key to Uint8Array ──
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
