// ===== HOTEL MAINTENANCE CHAT - SERVICE WORKER =====
// Handles push notifications, background sync, and offline capabilities

console.log('🔧 Service Worker: Starting...');

const CACHE_NAME = 'hk-mendeli-v1';
const SUPA_URL = 'https://tpfqcfnaynccdoxstvhz.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwZnFjZm5heW5jY2RveHN0dmh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MDU4NTQsImV4cCI6MjA5NzE4MTg1NH0.elqUF3tVLfCyFa3F2tvhX7oi-nnlr-AZ_RtgMboL68g';

let lastCheckedTime = Date.now();
let seenMessageIds = new Set();

// ===== CACHE ASSETS =====
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
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// ===== BACKGROUND MESSAGE POLLING =====
// Poll every 15 seconds for new messages
setInterval(() => {
  console.log('⏰ Service Worker: Polling for new messages...');
  checkForNewMessages();
}, 15000);

// Also check immediately on install
checkForNewMessages();

async function checkForNewMessages() {
  try {
    // Get current user info from IndexedDB
    const config = await getStoredConfig();
    if(!config || !config.currentUser) {
      console.log('⚠️ No stored config found');
      return;
    }

    console.log('👤 Checking messages for user:', config.currentUser);

    // Fetch all messages from all channels
    const url = SUPA_URL + '/rest/v1/chat_messages?order=created_at.desc&limit=100';
    const response = await fetch(url, {
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': 'Bearer ' + SUPA_KEY,
        'Content-Type': 'application/json'
      }
    });

    if(!response.ok) {
      console.log('❌ Fetch failed:', response.status);
      return;
    }

    const messages = await response.json();
    console.log('📨 Service Worker: Loaded', messages.length, 'messages');

    // Check for NEW messages from OTHERS
    messages.forEach(msg => {
      const msgId = `${msg.id}_${msg.created_at}`;
      const isFromOther = msg.sender !== config.currentUser;
      const isNew = !seenMessageIds.has(msgId);

      if(isNew && isFromOther) {
        seenMessageIds.add(msgId);
        console.log('✅ NEW MESSAGE from', msg.sender, 'in', msg.channel || 'general');
        showNotification(msg);
      } else if(isNew) {
        seenMessageIds.add(msgId);
      }
    });

  } catch(error) {
    console.error('❌ Error checking messages:', error);
  }
}

// ===== SHOW NOTIFICATION =====
async function showNotification(message) {
  try {
    // Check if permission is granted
    if(Notification.permission !== 'granted') {
      console.log('⚠️ Notification permission not granted');
      return;
    }

    const channelEmoji = {
      'reception': '🚪',
      'hk': '🧹',
      'maintenance': '🔧'
    };

    const emoji = channelEmoji[message.channel] || '💬';
    const channel = message.channel ? ` (#${message.channel})` : '';
    const title = `${emoji} New Message${channel}`;

    const options = {
      body: `${message.sender}: ${message.message.substring(0, 60)}${message.message.length > 60 ? '...' : ''}`,
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23185FA5" width="100" height="100"/><text x="50" y="65" font-size="50" fill="white" text-anchor="middle">💬</text></svg>',
      badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="%23E24B4A"/></svg>',
      tag: `chat-${message.id || Date.now()}`,
      requireInteraction: false,
      actions: [
        { action: 'open', title: 'Open' },
        { action: 'dismiss', title: 'Dismiss' }
      ],
      data: {
        url: '/?channel=' + (message.channel || 'general'),
        channel: message.channel,
        sender: message.sender
      }
    };

    console.log('🔔 Showing notification:', title);
    await self.registration.showNotification(title, options);
    console.log('✅ Notification displayed successfully');

  } catch(error) {
    console.error('❌ Notification error:', error);
  }
}

// ===== NOTIFICATION CLICK HANDLER =====
self.addEventListener('notificationclick', event => {
  console.log('👆 Notification clicked:', event.action);
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(clientList => {
      // Check if app is already open
      for(let client of clientList) {
        if(client.url === '/' || client.url.includes('mendeli')) {
          client.focus();
          // Send message to open chat for the channel
          if(event.notification.data?.channel) {
            client.postMessage({
              type: 'OPEN_CHANNEL',
              channel: event.notification.data.channel
            });
          }
          return;
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

// ===== MESSAGE HANDLING =====
self.addEventListener('message', event => {
  console.log('📬 Service Worker received message:', event.data);

  if(event.data?.type === 'SYNC_CONFIG') {
    // Store config from main app
    storeConfig(event.data.config);
  }
});

// ===== INDEXED DB HELPERS =====
function getStoredConfig() {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open('HKChatDB', 1);

      request.onsuccess = (event) => {
        const db = event.target.result;
        
        // Create object store if doesn't exist
        if(!db.objectStoreNames.contains('config')) {
          resolve(null);
          return;
        }

        const transaction = db.transaction(['config'], 'readonly');
        const store = transaction.objectStore('config');
        const getRequest = store.get('app-config');

        getRequest.onsuccess = () => {
          resolve(getRequest.result || null);
        };
        getRequest.onerror = () => {
          console.log('❌ IndexedDB get error');
          resolve(null);
        };
      };

      request.onerror = () => {
        console.log('❌ IndexedDB open error');
        resolve(null);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if(!db.objectStoreNames.contains('config')) {
          db.createObjectStore('config');
        }
      };
    } catch(error) {
      console.error('IndexedDB error:', error);
      resolve(null);
    }
  });
}

function storeConfig(config) {
  try {
    const request = indexedDB.open('HKChatDB', 1);

    request.onsuccess = (event) => {
      const db = event.target.result;

      if(!db.objectStoreNames.contains('config')) {
        db.close();
        return;
      }

      const transaction = db.transaction(['config'], 'readwrite');
      const store = transaction.objectStore('config');
      store.put(config, 'app-config');
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if(!db.objectStoreNames.contains('config')) {
        db.createObjectStore('config');
      }
    };
  } catch(error) {
    console.error('❌ Config storage error:', error);
  }
}

// ===== OFFLINE SUPPORT =====
self.addEventListener('fetch', event => {
  // For GET requests, try network first, fallback to cache
  if(event.request.method === 'GET') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache successful responses
          if(response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fall back to cache if network fails
          return caches.match(event.request)
            .then(response => response || new Response('Offline', { status: 503 }));
        })
    );
  }
});

// ===== PERIODIC BACKGROUND SYNC =====
if('periodicSync' in self.registration) {
  self.addEventListener('periodicsync', event => {
    if(event.tag === 'check-messages') {
      console.log('🔄 Periodic sync: Checking for new messages');
      event.waitUntil(checkForNewMessages());
    }
  });
}

console.log('✅ Service Worker: Ready!');
