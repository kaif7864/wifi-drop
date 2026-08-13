/**
 * client/src/utils/notification.js
 * Cross-platform System Notification Manager (Mobile PWA + Android Chrome + Desktop)
 * Uses ServiceWorkerRegistration.showNotification() for Android Chrome & PWA compatibility,
 * with fallback to window.Notification on Desktop.
 */

export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  try {
    if (Notification.permission === 'default') {
      return await Notification.requestPermission();
    }
    return Notification.permission;
  } catch (e) {
    console.warn('[Notification Permission Error]:', e);
    return 'denied';
  }
}

export async function sendSystemNotification(title, options = {}) {
  const notifEnabled = localStorage.getItem('wifidrop_notif_enabled') !== 'false';
  if (!notifEnabled) return;

  if (typeof window === 'undefined' || !('Notification' in window)) return;

  try {
    let perm = Notification.permission;
    if (perm === 'default') {
      perm = await Notification.requestPermission();
    }

    if (perm !== 'granted') return;

    const notifOptions = {
      icon: '/icons/icon-192x192.png',
      badge: '/favicon.png',
      vibrate: [200, 100, 200],
      renotify: true,
      tag: options.tag || 'wifidrop-notif-' + Date.now(),
      body: options.body || '',
      ...options,
    };

    // Mobile & PWA: Android Chrome REQUIRES Service Worker showNotification()
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.showNotification) {
          await reg.showNotification(title, notifOptions);
          return;
        }
      } catch (swErr) {
        console.warn('[SW showNotification fallback]:', swErr);
      }
    }

    // Desktop browser fallback
    new Notification(title, notifOptions);
  } catch (err) {
    console.warn('[System Notification Error]:', err);
  }
}
