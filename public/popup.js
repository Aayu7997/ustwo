// UsTwo Extension Popup
console.log('🎨 UsTwo Popup loaded');

class PopupManager {
  constructor() {
    this.userSession = null;
    this.currentRoom = null;
    this.currentPlayer = null;
    
    this.init();
  }

  async init() {
    console.log('🚀 Initializing popup...');
    
    // Get stored data
    await this.loadStoredData();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Check authentication
    await this.checkAuth();
    
    // Update UI
    await this.updateUI();
    
    // Start status updates
    this.startStatusUpdates();
  }

  async loadStoredData() {
    try {
      const result = await chrome.storage.local.get([
        'userSession', 
        'currentRoom', 
        'currentPlayer'
      ]);
      
      this.userSession = result.userSession;
      this.currentRoom = result.currentRoom;
      this.currentPlayer = result.currentPlayer;
      
      console.log('📦 Loaded stored data:', {
        hasSession: !!this.userSession,
        hasRoom: !!this.currentRoom,
        hasPlayer: !!this.currentPlayer
      });
    } catch (error) {
      console.error('❌ Failed to load stored data:', error);
    }
  }

  setupEventListeners() {
    // Authentication
    document.getElementById('sign-in-btn').addEventListener('click', () => {
      this.openWebApp();
    });
    
    // Room actions
    document.getElementById('join-room-btn').addEventListener('click', () => {
      this.joinRoom();
    });
    
    document.getElementById('create-room-btn').addEventListener('click', () => {
      this.createRoom();
    });
    
    document.getElementById('leave-room-btn').addEventListener('click', () => {
      this.leaveRoom();
    });
    
    document.getElementById('copy-room-code').addEventListener('click', () => {
      this.copyRoomCode();
    });
    
    // Input handlers
    document.getElementById('room-code-input').addEventListener('input', (e) => {
      e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    });
    
    document.getElementById('room-code-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.joinRoom();
      }
    });
    
    document.getElementById('room-name-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.createRoom();
      }
    });
  }

  async checkAuth() {
    if (!this.userSession) {
      console.log('❌ No user session found');
      return false;
    }
    
    // Check if session is still valid
    try {
      const response = await fetch('https://mxatgocmnasozbkbjiuq.supabase.co/auth/v1/user', {
        headers: {
          'Authorization': `Bearer ${this.userSession.access_token}`,
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14YXRnb2NtbmFzb3pia2JqaXVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4MDA5MzgsImV4cCI6MjA2OTM3NjkzOH0.ijTHgUylTxN--454y2iN29lQpnydXvNGA2wfuDDZp1Q'
        }
      });
      
      if (response.ok) {
        console.log('✅ User session valid');
        return true;
      } else {
        console.log('❌ User session expired');
        this.userSession = null;
        await chrome.storage.local.remove('userSession');
        return false;
      }
    } catch (error) {
      console.error('❌ Auth check failed:', error);
      return false;
    }
  }

  async updateUI() {
    const loading = document.getElementById('loading');
    const authSection = document.getElementById('auth-section');
    const mainContent = document.getElementById('main-content');
    const noRoomSection = document.getElementById('no-room-section');
    const inRoomSection = document.getElementById('in-room-section');
    
    // Hide loading
    loading.classList.add('hidden');
    
    if (!this.userSession) {
      // Show auth section
      authSection.classList.remove('hidden');
      mainContent.classList.add('hidden');
      return;
    }
    
    // Show main content
    authSection.classList.add('hidden');
    mainContent.classList.remove('hidden');
    
    // Update player status
    this.updatePlayerStatus();
    
    // Update room status
    if (this.currentRoom) {
      noRoomSection.classList.add('hidden');
      inRoomSection.classList.remove('hidden');
      
      document.getElementById('current-room-code').textContent = this.currentRoom.room_code;
    } else {
      noRoomSection.classList.remove('hidden');
      inRoomSection.classList.add('hidden');
    }
    
    // Get latest room state from background
    const roomState = await this.getRoomState();
    if (roomState) {
      this.updateSyncStatus(roomState);
    }
  }

  updatePlayerStatus() {
    const statusDot = document.getElementById('player-status-dot');
    const statusText = document.getElementById('player-status-text');
    const platformInfo = document.getElementById('platform-info');
    
    if (this.currentPlayer) {
      statusDot.className = 'status-dot';
      statusText.textContent = `${this.currentPlayer.platform} detected`;
      
      document.getElementById('platform-name').textContent = this.currentPlayer.platform;
      document.getElementById('platform-url').textContent = this.currentPlayer.url;
      
      platformInfo.classList.remove('hidden');
    } else {
      statusDot.className = 'status-dot disconnected';
      statusText.textContent = 'No video player detected';
      platformInfo.classList.add('hidden');
    }
  }

  updateSyncStatus(roomState) {
    const syncDot = document.getElementById('sync-status-dot');
    const syncText = document.getElementById('sync-status-text');
    
    if (roomState.connected && roomState.syncEnabled) {
      syncDot.className = 'status-dot';
      syncText.textContent = 'Sync enabled';
    } else if (roomState.room) {
      syncDot.className = 'status-dot disconnected';
      syncText.textContent = 'Connecting...';
    } else {
      syncDot.className = 'status-dot error';
      syncText.textContent = 'Sync disabled';
    }
  }

  async getRoomState() {
    try {
      return await this.sendMessageToBackground({ type: 'GET_ROOM_STATE' });
    } catch (error) {
      console.error('❌ Failed to get room state:', error);
      return null;
    }
  }

  async joinRoom() {
    const roomCodeInput = document.getElementById('room-code-input');
    const roomCode = roomCodeInput.value.trim();
    
    if (!roomCode || roomCode.length !== 6) {
      this.showMessage('Please enter a valid 6-character room code', 'error');
      return;
    }
    
    if (!this.userSession) {
      this.showMessage('Please sign in first', 'error');
      return;
    }
    
    try {
      this.setButtonLoading('join-room-btn', true);
      
      const result = await this.sendMessageToBackground({
        type: 'JOIN_ROOM',
        roomCode: roomCode,
        userSession: this.userSession
      });
      
      if (result.success) {
        this.currentRoom = result.room;
        await chrome.storage.local.set({ currentRoom: result.room });
        
        this.showMessage('Successfully joined room!', 'success');
        roomCodeInput.value = '';
        await this.updateUI();
      } else {
        this.showMessage(result.error || 'Failed to join room', 'error');
      }
    } catch (error) {
      console.error('❌ Join room failed:', error);
      this.showMessage('Failed to join room', 'error');
    } finally {
      this.setButtonLoading('join-room-btn', false);
    }
  }

  async createRoom() {
    const roomNameInput = document.getElementById('room-name-input');
    const roomName = roomNameInput.value.trim();
    
    if (!roomName) {
      this.showMessage('Please enter a room name', 'error');
      return;
    }
    
    if (!this.userSession) {
      this.showMessage('Please sign in first', 'error');
      return;
    }
    
    try {
      this.setButtonLoading('create-room-btn', true);
      
      const result = await this.sendMessageToBackground({
        type: 'CREATE_ROOM',
        roomName: roomName,
        userSession: this.userSession
      });
      
      if (result.success) {
        this.currentRoom = result.room;
        await chrome.storage.local.set({ currentRoom: result.room });
        
        this.showMessage('Room created successfully!', 'success');
        roomNameInput.value = '';
        await this.updateUI();
      } else {
        this.showMessage(result.error || 'Failed to create room', 'error');
      }
    } catch (error) {
      console.error('❌ Create room failed:', error);
      this.showMessage('Failed to create room', 'error');
    } finally {
      this.setButtonLoading('create-room-btn', false);
    }
  }

  async leaveRoom() {
    try {
      this.setButtonLoading('leave-room-btn', true);
      
      await this.sendMessageToBackground({ type: 'LEAVE_ROOM' });
      
      this.currentRoom = null;
      this.showMessage('Left room successfully', 'success');
      await this.updateUI();
    } catch (error) {
      console.error('❌ Leave room failed:', error);
      this.showMessage('Failed to leave room', 'error');
    } finally {
      this.setButtonLoading('leave-room-btn', false);
    }
  }

  async copyRoomCode() {
    if (!this.currentRoom) return;
    
    try {
      await navigator.clipboard.writeText(this.currentRoom.room_code);
      this.showMessage('Room code copied to clipboard!', 'success');
    } catch (error) {
      console.error('❌ Copy failed:', error);
      this.showMessage('Failed to copy room code', 'error');
    }
  }

  openWebApp() {
    // Open the app's sign-in page so the extension can use your session
    chrome.tabs.create({
      url: 'https://8f0d288f-f962-4e64-8c48-4ba23504db46.lovableproject.com/auth'
    });
  }

  async sendMessageToBackground(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
  }

  setButtonLoading(buttonId, loading) {
    const button = document.getElementById(buttonId);
    if (loading) {
      button.disabled = true;
      button.textContent = 'Loading...';
    } else {
      button.disabled = false;
      // Restore original text based on button
      switch (buttonId) {
        case 'join-room-btn':
          button.textContent = 'Join Partner\'s Room';
          break;
        case 'create-room-btn':
          button.textContent = 'Create New Room';
          break;
        case 'leave-room-btn':
          button.textContent = 'Leave Room';
          break;
      }
    }
  }

  showMessage(text, type = 'info') {
    const container = document.getElementById('message-container');
    
    // Remove existing messages
    container.innerHTML = '';
    
    const message = document.createElement('div');
    message.className = type === 'error' ? 'error-message' : 'success-message';
    message.textContent = text;
    
    container.appendChild(message);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      if (message.parentNode) {
        message.remove();
      }
    }, 5000);
  }

  startStatusUpdates() {
    // Update player and room status every 3 seconds
    setInterval(async () => {
      await this.loadStoredData();
      
      if (this.userSession) {
        this.updatePlayerStatus();
        
        const roomState = await this.getRoomState();
        if (roomState) {
          this.updateSyncStatus(roomState);
        }
      }
    }, 3000);
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});