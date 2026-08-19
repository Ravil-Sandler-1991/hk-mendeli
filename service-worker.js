// Service Worker for Background Notifications
console.log('🔧 Service Worker starting...');

let lastSeenMessages = [];

// Start checking immediately
console.log('⏰ Service Worker: Setting up 15-second polling...');
setInterval(() => {
  console.log('🔄 Service Worker: Checking for messages...');
  checkForNewMessages().catch(e => console.log('Poll error:', e));
}, 15000);

// Check for new messages
async function checkForNewMessages() {
  try {
    // Get config from IndexedDB
    const config = await getConfig();
    if(!config) {
      console.log('❌ No config found');
      return;
    }

    const url = config.supaUrl + '/rest/v1/chat_messages?order=created_at.asc';
    const res = await fetch(url, {
      headers: {
        'Authorization': 'Bearer ' + config.supaKey,
        'apikey': config.supaKey
      }
    });

    if(!res.ok) return;

    const msgs = await res.json();
    console.log('📨 SW: Loaded', msgs.length, 'messages. Current user:', config.currentUser);
    
    // Check for NEW messages
    msgs.forEach(msg => {
      const msgId = String(msg.id || (msg.sender + msg.created_at));
      const isFromOther = msg.sender !== config.currentUser; // KEY: Only from OTHERS
      
      console.log('📧 SW: Message from', msg.sender, '- Seen?', lastSeenMessages.includes(msgId), '- FromOther?', isFromOther);
      
      if(!lastSeenMessages.includes(msgId) && isFromOther) {
        // New message from someone else!
        lastSeenMessages.push(msgId);
        console.log('✅ SW: NEW MESSAGE from', msg.sender);
        showNotification(msg);
      }
    });
  } catch(e) {
    console.log('❌ Background check error:', e);
  }
}

// Show notification
function showNotification(msg) {
  console.log('🔔 SW: Showing notification for message from', msg.sender);
  
  const options = {
    body: msg.sender + ': ' + msg.message.substring(0, 50),
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23185FA5" width="100" height="100"/><text x="50" y="70" font-size="60" font-weight="bold" fill="white" text-anchor="middle">💬</text></svg>',
    badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="%23E24B4A"/></svg>',
    tag: 'chat-' + msg.id,
    requireInteraction: false,
    data: { url: '/' }
  };

  self.registration.showNotification('💬 New Message', options);
  console.log('✅ SW: Notification displayed');
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
