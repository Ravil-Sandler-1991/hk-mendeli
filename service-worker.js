// Service Worker for Background Push Notifications
console.log('🔧 Service Worker registered');

let lastSeenMessages = [];

// Listen for messages from the app
self.addEventListener('message', (event) => {
  if(event.data && event.data.type === 'INIT_SW') {
    console.log('📱 Service Worker initialized with config');
    lastSeenMessages = event.data.seenMessages || [];
  }
});

// Background sync to check for new messages
self.addEventListener('sync', (event) => {
  if(event.tag === 'check-messages') {
    event.waitUntil(checkForNewMessages());
  }
});

// Main function to check for messages
async function checkForNewMessages() {
  try {
    const config = await getConfig();
    if(!config) return;

    const url = config.supaUrl + '/rest/v1/chat_messages?order=created_at.asc';
    const res = await fetch(url, {
      headers: {
        'Authorization': 'Bearer ' + config.supaKey,
        'apikey': config.supaKey
      }
    });

    if(!res.ok) return;

    const msgs = await res.json();
    
    // Check for new messages
    msgs.forEach(msg => {
      const msgId = msg.id || msg.sender + msg.created_at;
      
      if(!lastSeenMessages.includes(msgId) && msg.sender !== config.currentUser) {
        // New message from someone else!
        lastSeenMessages.push(msgId);
        showNotification(msg);
      }
    });
  } catch(e) {
    console.log('❌ Background check error:', e);
  }
}

// Show notification
function showNotification(msg) {
  const options = {
    body: msg.sender + ': ' + msg.message.substring(0, 50),
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23185FA5" width="100" height="100"/><text x="50" y="70" font-size="60" font-weight="bold" fill="white" text-anchor="middle">💬</text></svg>',
    badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="%23E24B4A"/></svg>',
    tag: 'chat-' + msg.id,
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: { url: '/' }
  };

  self.registration.showNotification('💬 New Message', options);
  console.log('🔔 Notification shown for message from ' + msg.sender);
}

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for(let i = 0; i < clientList.length; i++) {
        if(clientList[i].url === '/' && 'focus' in clientList[i]) {
          return clientList[i].focus();
        }
      }
      if(clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// Get config from IndexedDB
function getConfig() {
  return new Promise((resolve) => {
    const request = indexedDB.open('HKChatDB', 1);
    request.onsuccess = (e) => {
      const db = e.target.result;
      const txn = db.transaction(['config'], 'readonly');
      const store = txn.objectStore('config');
      const getRequest = store.get('app-config');
      getRequest.onsuccess = () => resolve(getRequest.result);
      getRequest.onerror = () => resolve(null);
    };
    request.onerror = () => resolve(null);
  });
}

// Periodically check for messages
setInterval(() => {
  checkForNewMessages().catch(e => console.log('Poll error:', e));
}, 15000); // Check every 15 seconds
