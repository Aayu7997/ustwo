// UsTwo Background Service Worker - Room Sync & WebSocket Management
console.log('🚀 UsTwo Background Service Worker started');

class RoomSyncManager {
  constructor() {
    this.currentRoom = null;
    this.websocket = null;
    this.currentTab = null;
    this.syncEnabled = false;
    this.heartbeatInterval = null;
    
    this.init();
  }

  init() {
    // Listen for messages from content script and popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep channel open for async response
    });
    
    // Listen for tab updates to track current video tab
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && this.isVideoTab(tab.url)) {
        this.currentTab = tab;
        console.log('📺 Video tab updated:', tab.url);
      }
    });
    
    // Handle extension startup - restore room state
    this.restoreRoomState();
  }

  async restoreRoomState() {
    try {
      const result = await chrome.storage.local.get(['currentRoom', 'userSession']);
      if (result.currentRoom && result.userSession) {
        console.log('🔄 Restoring room state:', result.currentRoom.room_code);
        this.currentRoom = result.currentRoom;
        await this.connectToRoom(result.currentRoom, result.userSession);
      }
    } catch (error) {
      console.error('❌ Failed to restore room state:', error);
    }
  }

  async handleMessage(message, sender, sendResponse) {
    console.log('📨 Background received:', message.type);
    
    try {
      switch (message.type) {
        case 'PLAYER_DETECTED':
          await this.handlePlayerDetected(message, sender.tab);
          sendResponse({ success: true });
          break;
          
        case 'PLAYBACK_EVENT':
          await this.handlePlaybackEvent(message);
          sendResponse({ success: true });
          break;
          
        case 'TIME_SYNC':
          await this.handleTimeSync(message);
          sendResponse({ success: true });
          break;
          
        case 'JOIN_ROOM':
          const joinResult = await this.joinRoom(message.roomCode, message.userSession);
          sendResponse(joinResult);
          break;
          
        case 'CREATE_ROOM':
          const createResult = await this.createRoom(message.roomName, message.userSession);
          sendResponse(createResult);
          break;
          
        case 'LEAVE_ROOM':
          await this.leaveRoom();
          sendResponse({ success: true });
          break;
          
        case 'GET_ROOM_STATE':
          sendResponse({
            room: this.currentRoom,
            syncEnabled: this.syncEnabled,
            connected: !!this.websocket
          });
          break;
          
        case 'OPEN_POPUP':
          chrome.action.openPopup();
          sendResponse({ success: true });
          break;
          
        default:
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('❌ Error handling message:', error);
      sendResponse({ error: error.message });
    }
  }

  async handlePlayerDetected(message, tab) {
    console.log(`🎬 Player detected: ${message.platform} on tab ${tab.id}`);
    this.currentTab = tab;
    
    // Store tab info
    await chrome.storage.local.set({
      currentPlayer: {
        platform: message.platform,
        url: message.url,
        title: message.title,
        tabId: tab.id
      }
    });
    
    // If we're in a room, notify content script
    if (this.currentRoom) {
      this.sendToContentScript({
        type: 'JOIN_ROOM',
        roomCode: this.currentRoom.room_code
      });
    }
  }

  async handlePlaybackEvent(message) {
    if (!this.syncEnabled || !this.websocket || !this.currentRoom) {
      console.log('⚠️ Sync not enabled or not in room');
      return;
    }
    
    console.log(`🔄 Broadcasting playback event: ${message.action}`);
    
    // Send to Supabase realtime
    this.websocket.send(JSON.stringify({
      type: 'broadcast',
      event: 'playback_sync',
      payload: {
        room_id: this.currentRoom.id,
        action: message.action,
        current_time: message.currentTime,
        timestamp: message.timestamp,
        url: this.currentTab?.url
      }
    }));
  }

  async handleTimeSync(message) {
    if (!this.currentRoom) return;
    
    // Store current playback state
    await chrome.storage.local.set({
      lastPlaybackState: {
        currentTime: message.currentTime,
        paused: message.paused,
        timestamp: Date.now()
      }
    });
  }

  async joinRoom(roomCode, userSession) {
    try {
      console.log('🚪 Joining room:', roomCode);
      
      // Call your existing API to join room
      const response = await fetch('https://mxatgocmnasozbkbjiuq.supabase.co/rest/v1/rpc/join_room_by_code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userSession.access_token}`,
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14YXRnb2NtbmFzb3pia2JqaXVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4MDA5MzgsImV4cCI6MjA2OTM3NjkzOH0.ijTHgUylTxN--454y2iN29lQpnydXvNGA2wfuDDZp1Q'
        },
        body: JSON.stringify({ room_code: roomCode })
      });
      
      if (!response.ok) {
        throw new Error('Failed to join room');
      }
      
      const room = await response.json();
      this.currentRoom = room;
      
      // Store room state
      await chrome.storage.local.set({
        currentRoom: room,
        userSession: userSession
      });
      
      // Connect to realtime
      await this.connectToRoom(room, userSession);
      
      // Notify content script
      this.sendToContentScript({
        type: 'JOIN_ROOM',
        roomCode: room.room_code
      });
      
      return { success: true, room };
      
    } catch (error) {
      console.error('❌ Failed to join room:', error);
      return { error: error.message };
    }
  }

  async createRoom(roomName, userSession) {
    try {
      console.log('🏗️ Creating room:', roomName);
      
      const response = await fetch('https://mxatgocmnasozbkbjiuq.supabase.co/rest/v1/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userSession.access_token}`,
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14YXRnb2NtbmFzb3pia2JqaXVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4MDA5MzgsImV4cCI6MjA2OTM3NjkzOH0.ijTHgUylTxN--454y2iN29lQpnydXvNGA2wfuDDZp1Q'
        },
        body: JSON.stringify({
          name: roomName,
          created_by: userSession.user.id
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to create room');
      }
      
      const room = await response.json();
      this.currentRoom = room;
      
      // Store room state
      await chrome.storage.local.set({
        currentRoom: room,
        userSession: userSession
      });
      
      // Connect to realtime
      await this.connectToRoom(room, userSession);
      
      return { success: true, room };
      
    } catch (error) {
      console.error('❌ Failed to create room:', error);
      return { error: error.message };
    }
  }

  async connectToRoom(room, userSession) {
    console.log('🔌 Connecting to room realtime...');
    
    // Disconnect existing connection
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    
    try {
      // Connect to Supabase realtime WebSocket
      const wsUrl = `wss://mxatgocmnasozbkbjiuq.supabase.co/realtime/v1/websocket?access_token=${userSession.access_token}&apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14YXRnb2NtbmFzb3pia2JqaXVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4MDA5MzgsImV4cCI6MjA2OTM3NjkzOH0.ijTHgUylTxN--454y2iN29lQpnydXvNGA2wfuDDZp1Q`;
      
      this.websocket = new WebSocket(wsUrl);
      
      this.websocket.onopen = () => {
        console.log('✅ WebSocket connected');
        this.syncEnabled = true;
        
        // Join the room channel
        this.websocket.send(JSON.stringify({
          topic: `room:${room.id}`,
          event: 'phx_join',
          payload: {},
          ref: Date.now()
        }));
        
        // Setup heartbeat
        this.startHeartbeat();
      };
      
      this.websocket.onmessage = (event) => {
        this.handleWebSocketMessage(JSON.parse(event.data));
      };
      
      this.websocket.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        this.syncEnabled = false;
        this.stopHeartbeat();
        
        // Attempt reconnection
        setTimeout(() => {
          if (this.currentRoom) {
            this.connectToRoom(this.currentRoom, userSession);
          }
        }, 5000);
      };
      
    } catch (error) {
      console.error('❌ WebSocket connection failed:', error);
    }
  }

  handleWebSocketMessage(data) {
    if (data.event === 'broadcast' && data.payload.event === 'playback_sync') {
      const syncData = data.payload.payload;
      
      // Don't sync our own events
      if (syncData.user_id === this.currentRoom?.created_by) return;
      
      console.log('📥 Received sync event:', syncData.action);
      
      // Send to content script for playback control
      this.sendToContentScript({
        type: 'SYNC_PLAYBACK',
        data: syncData
      });
    }
  }

  async sendToContentScript(message) {
    if (!this.currentTab) return;
    
    try {
      await chrome.tabs.sendMessage(this.currentTab.id, message);
    } catch (error) {
      console.error('❌ Failed to send message to content script:', error);
    }
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        this.websocket.send(JSON.stringify({
          topic: 'phoenix',
          event: 'heartbeat',
          payload: {},
          ref: Date.now()
        }));
      }
    }, 30000); // Every 30 seconds
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  async leaveRoom() {
    console.log('🚪 Leaving room...');
    
    this.currentRoom = null;
    this.syncEnabled = false;
    
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    
    this.stopHeartbeat();
    
    // Clear storage
    await chrome.storage.local.remove(['currentRoom', 'userSession']);
    
    // Notify content script
    this.sendToContentScript({
      type: 'ROOM_LEFT'
    });
  }

  isVideoTab(url) {
    if (!url) return false;
    
    const videoSites = [
      'netflix.com',
      'primevideo.com', 
      'hotstar.com',
      'youtube.com',
      'hulu.com',
      'disneyplus.com',
      'hbomax.com',
      'crunchyroll.com'
    ];
    
    return videoSites.some(site => url.includes(site));
  }
}

// Initialize the room sync manager
new RoomSyncManager();