const CACHE_NAME = 'hk-mendeli-v1';
const urlsToCache = [
  '/hk-mendeli/',
  '/hk-mendeli/index.html',
  '/hk-mendeli/manifest.json'
];

// Install Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache).catch(() => {
        console.log('Some URLs could not be cached');
      });
    })
  );
  self.skipWaiting();
});

// Activate Service Worker
self.addEventListener('activate', event => {
  event.waitUntil(clients.claim());
});

// Fetch Strategy: Network first, fallback to cache
self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});

// Handle Push Notifications (Lock Screen)
self.addEventListener('push', (event) => {
  console.log('🔔 Push event received:', event);
  
  let data = { 
    title: 'Mendeli HK', 
    body: 'New notification received' 
  };
  
  if (event.data) {
    try {
      data = event.data.json();
      console.log('📬 Push data:', data);
    } catch (e) {
      data.body = event.data.text();
    }
  }
  
  const options = {
    body: data.body,
    icon: '/hk-mendeli/icons/icon-192.png',
    badge: '/hk-mendeli/icons/icon-192.png',
    vibrate: [100, 50, 100],
    data: data.data || { url: '/hk-mendeli/' }
  };
  
  console.log('📢 Showing notification with options:', options);
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle Notification Click (User taps lock screen banner)
self.addEventListener('notificationclick', (event) => {
  console.log('👆 Notification clicked:', event.notification);
  
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/hk-mendeli/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('hk-mendeli') && 'focus' in client) {
          console.log('✅ Focusing existing client');
          return client.focus();
        }
      }
      if (clients.openWindow) {
        console.log('✅ Opening new window:', targetUrl);
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Handle Notification Close
self.addEventListener('notificationclose', (event) => {
  console.log('✕ Notification closed');
});
