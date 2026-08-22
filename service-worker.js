const CACHE_NAME = 'hk-mendeli-v1';
const urlsToCache = [
  '/hk-mendeli/',
  '/hk-mendeli/index.html',
  '/hk-mendeli/manifest.json'
];

console.log('🚀 Service Worker loading...');

// Install Service Worker
self.addEventListener('install', event => {
  console.log('📦 Installing Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache).catch(() => {
        console.log('⚠️ Some URLs could not be cached');
      });
    })
  );
  self.skipWaiting();
});

// Activate Service Worker
self.addEventListener('activate', event => {
  console.log('✅ Activating Service Worker...');
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

// ===== HANDLE PUSH NOTIFICATIONS (Lock Screen) =====
self.addEventListener('push', (event) => {
  console.log('🔔 PUSH EVENT RECEIVED!');
  console.log('Event:', event);
  console.log('Event data:', event.data);
  
  let notificationData = {
    title: '💬 New Message',
    body: 'You have a new message',
    icon: '/hk-mendeli/icons/icon-192.png',
    badge: '/hk-mendeli/icons/icon-192.png',
    tag: 'notification',
    requireInteraction: false,
    vibrate: [100, 50, 100],
    data: {
      url: '/hk-mendeli/'
    }
  };
  
  // Try to extract data from push event
  if (event.data) {
    try {
      const jsonData = event.data.json();
      console.log('📬 Parsed push data:', jsonData);
      
      // Update notification with received data
      if (jsonData.title) notificationData.title = jsonData.title;
      if (jsonData.body) notificationData.body = jsonData.body;
      if (jsonData.channel) notificationData.data.channel = jsonData.channel;
      if (jsonData.sender) notificationData.data.sender = jsonData.sender;
      if (jsonData.url) notificationData.data.url = jsonData.url;
    } catch (e) {
      console.error('❌ Error parsing push data:', e);
      try {
        notificationData.body = event.data.text();
      } catch (e2) {
        console.error('❌ Could not get text data:', e2);
      }
    }
  }
  
  console.log('📢 About to show notification with:', notificationData);
  console.log('   Title:', notificationData.title);
  console.log('   Body:', notificationData.body);
  
  // Show the notification
  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      vibrate: notificationData.vibrate,
      data: notificationData.data
    }).then(() => {
      console.log('✅ Notification shown successfully!');
    }).catch((error) => {
      console.error('❌ FAILED to show notification:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    })
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

// Handle messages from clients
self.addEventListener('message', (event) => {
  console.log('💌 Message received by Service Worker:', event.data);
});
