// ===== MENDELI HK SERVICE WORKER =====
// Handles Web Push notifications (replaces 15-second polling)

const CACHE_NAME = 'hk-mendeli-v1';
const SUPA_URL = 'https://tpfqcfnaynccdoxstvhz.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwZnFjZm5heW5jY2RveHN0dmh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MDU4NTQsImV4cCI6MjA5NzE4MTg1NH0.elqUF3tVLfCyFa3F2tvhX7oi-nnlr-AZ_RtgMboL68g';

console.log('🔧 Service Worker: Initializing...');

// ===== CACHE SETUP =====
self.addEventListener('install', event => {
  console.log('📦 Service Worker: Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('🚀 Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if(cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// ===== WEB PUSH NOTIFICATION LISTENER =====
// This replaces the old 15-second polling
self.addEventListener('push', event => {
  console.log('🔔 Push event received!');
  
  let data = {
    title: '💬 New Message',
    body: 'You have a new message',
    icon: '🔔',
    badge: '🏨'
  };
  
  // Parse push event data
  if(event.data) {
    try {
      data = event.data.json();
      console.log('📨 Push data:', data);
    } catch(e) {
      data.body = event.data.text();
    }
  }
  
  // Show notification
  const options = {
    body: data.body,
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect fill="%23185FA5" width="192" height="192"/><text x="96" y="140" font-size="120" fill="white" text-anchor="middle" font-weight="bold">HK</text></svg>',
    badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><circle cx="48" cy="48" r="45" fill="%23E24B4A"/></svg>',
    tag: data.tag || 'default',
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: data
  };
  
  // Add actions if ticket
  if(data.ticket_id) {
    options.actions = [
      { action: 'open', title: 'Open' },
      { action: 'close', title: 'Dismiss' }
    ];
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title || '💬 Mendeli HK', options)
      .then(() => console.log('✅ Notification displayed'))
      .catch(err => console.error('❌ Notification error:', err))
  );
});

// ===== NOTIFICATION CLICK HANDLER =====
self.addEventListener('notificationclick', event => {
  console.log('👆 Notification clicked:', event.action);
  
  event.notification.close();
  
  // Handle different actions
  if(event.action === 'close') {
    return;
  }
  
  // Determine URL to open
  let urlToOpen = '/hk-mendeli/';
  if(event.notification.data && event.notification.data.ticket_id) {
    urlToOpen += '?ticket=' + event.notification.data.ticket_id + '&channel=' + (event.notification.data.channel || 'maintenance');
  }
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(clientList => {
      // Check if app is already open
      for(let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if(client.url === urlToOpen || client.url.includes('hk-mendeli')) {
          return client.focus();
        }
      }
      // If not open, open it
      if(clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

self.addEventListener('notificationclose', event => {
  console.log('✕ Notification dismissed');
});

// ===== OFFLINE SUPPORT =====
self.addEventListener('fetch', event => {
  if(event.request.method === 'GET') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if(response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request)
            .then(response => response || new Response('Offline', { status: 503 }));
        })
    );
  }
});

console.log('✅ Service Worker: Ready!');
