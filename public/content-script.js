// UsTwo Content Script - Video Player Detection & Control
console.log('🎬 UsTwo Content Script loaded on:', window.location.hostname);

class VideoPlayerController {
  constructor() {
    this.currentPlayer = null;
    this.isControllingPlayback = false;
    this.lastSyncTime = 0;
    this.syncThreshold = 1000; // 1 second drift tolerance
    this.platformDetectors = {
      'www.netflix.com': this.detectNetflix.bind(this),
      'www.primevideo.com': this.detectPrimeVideo.bind(this), 
      'www.hotstar.com': this.detectHotstar.bind(this),
      'www.youtube.com': this.detectYouTube.bind(this),
      'www.hulu.com': this.detectHulu.bind(this),
      'www.disneyplus.com': this.detectDisneyPlus.bind(this),
      'play.hbomax.com': this.detectHBOMax.bind(this),
      'www.crunchyroll.com': this.detectCrunchyroll.bind(this)
    };
    
    this.init();
  }

  async init() {
    console.log('🔍 Initializing video player detection...');
    
    // Wait for page to load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.detectPlayer());
    } else {
      this.detectPlayer();
    }
    
    // Re-detect on navigation changes (SPA routing)
    let lastUrl = window.location.href;
    new MutationObserver(() => {
      if (lastUrl !== window.location.href) {
        lastUrl = window.location.href;
        setTimeout(() => this.detectPlayer(), 2000);
      }
    }).observe(document, { subtree: true, childList: true });
    
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sendResponse);
      return true; // Keep channel open for async response
    });
  }

  detectPlayer() {
    const hostname = window.location.hostname;
    const detector = this.platformDetectors[hostname];
    
    if (detector) {
      console.log(`🎯 Detecting ${hostname} player...`);
      detector();
    } else {
      console.log('❌ Platform not supported:', hostname);
    }
  }

  detectNetflix() {
    const video = document.querySelector('video');
    if (video) {
      this.setupPlayer(video, 'Netflix', {
        playButton: '.button-nfplayerPlay',
        pauseButton: '.button-nfplayerPause',
        timeDisplay: '.time-remaining-display'
      });
    }
  }

  detectPrimeVideo() {
    const video = document.querySelector('video, [data-testid="video-player"] video');
    if (video) {
      this.setupPlayer(video, 'Prime Video', {
        playButton: '[data-testid="play-button"]',
        pauseButton: '[data-testid="pause-button"]',
        timeDisplay: '.atvwebplayersdk-timeindicator-text'
      });
    }
  }

  detectHotstar() {
    const video = document.querySelector('video');
    if (video) {
      this.setupPlayer(video, 'Hotstar', {
        playButton: '.control-play',
        pauseButton: '.control-pause', 
        timeDisplay: '.time-display'
      });
    }
  }

  detectYouTube() {
    const video = document.querySelector('video.html5-video-player, #movie_player video');
    if (video) {
      this.setupPlayer(video, 'YouTube', {
        playButton: '.ytp-play-button',
        pauseButton: '.ytp-pause-button',
        timeDisplay: '.ytp-time-current'
      });
    }
  }

  detectHulu() {
    const video = document.querySelector('video');
    if (video) {
      this.setupPlayer(video, 'Hulu', {
        playButton: '.controls__play-pause-button',
        timeDisplay: '.time-display'
      });
    }
  }

  detectDisneyPlus() {
    const video = document.querySelector('video');
    if (video) {
      this.setupPlayer(video, 'Disney+', {
        playButton: '.bttn--play',
        pauseButton: '.bttn--pause'
      });
    }
  }

  detectHBOMax() {
    const video = document.querySelector('video');
    if (video) {
      this.setupPlayer(video, 'HBO Max', {
        playButton: '[data-testid="play"]',
        pauseButton: '[data-testid="pause"]'
      });
    }
  }

  detectCrunchyroll() {
    const video = document.querySelector('video');
    if (video) {
      this.setupPlayer(video, 'Crunchyroll', {
        playButton: '.play-button',
        timeDisplay: '.time-current'
      });
    }
  }

  setupPlayer(videoElement, platform, selectors) {
    if (this.currentPlayer === videoElement) return;
    
    console.log(`✅ ${platform} player detected!`);
    this.currentPlayer = videoElement;
    
    // Send platform info to background
    chrome.runtime.sendMessage({
      type: 'PLAYER_DETECTED',
      platform,
      url: window.location.href,
      title: document.title
    });
    
    // Setup event listeners
    this.setupVideoEventListeners(videoElement);
    
    // Create floating sync button
    this.createSyncButton(platform);
  }

  setupVideoEventListeners(video) {
    // Remove existing listeners
    if (this.videoEventListeners) {
      this.videoEventListeners.forEach(({ event, handler }) => {
        video.removeEventListener(event, handler);
      });
    }
    
    const handlers = {
      play: () => this.onVideoPlay(),
      pause: () => this.onVideoPause(), 
      seeked: () => this.onVideoSeeked(),
      timeupdate: () => this.onTimeUpdate()
    };
    
    this.videoEventListeners = Object.entries(handlers).map(([event, handler]) => {
      video.addEventListener(event, handler);
      return { event, handler };
    });
  }

  onVideoPlay() {
    if (this.isControllingPlayback) return;
    
    console.log('▶️ Video played by user');
    chrome.runtime.sendMessage({
      type: 'PLAYBACK_EVENT',
      action: 'play',
      currentTime: this.currentPlayer.currentTime,
      timestamp: Date.now()
    });
  }

  onVideoPause() {
    if (this.isControllingPlayback) return;
    
    console.log('⏸️ Video paused by user');
    chrome.runtime.sendMessage({
      type: 'PLAYBACK_EVENT', 
      action: 'pause',
      currentTime: this.currentPlayer.currentTime,
      timestamp: Date.now()
    });
  }

  onVideoSeeked() {
    if (this.isControllingPlayback) return;
    
    console.log('⏩ Video seeked by user to:', this.currentPlayer.currentTime);
    chrome.runtime.sendMessage({
      type: 'PLAYBACK_EVENT',
      action: 'seek', 
      currentTime: this.currentPlayer.currentTime,
      timestamp: Date.now()
    });
  }

  onTimeUpdate() {
    // Periodically sync time to detect drift
    const now = Date.now();
    if (now - this.lastSyncTime > 5000) { // Every 5 seconds
      this.lastSyncTime = now;
      chrome.runtime.sendMessage({
        type: 'TIME_SYNC',
        currentTime: this.currentPlayer.currentTime,
        paused: this.currentPlayer.paused
      });
    }
  }

  handleMessage(message, sendResponse) {
    console.log('📨 Received message:', message);
    
    switch (message.type) {
      case 'SYNC_PLAYBACK':
        this.syncPlayback(message.data);
        sendResponse({ success: true });
        break;
        
      case 'GET_PLAYER_STATE':
        sendResponse(this.getPlayerState());
        break;
        
      case 'JOIN_ROOM':
        this.showSyncStatus('Connected to room: ' + message.roomCode);
        sendResponse({ success: true });
        break;
        
      case 'PARTNER_JOINED':
        this.showSyncStatus('Partner joined! Sync enabled.');
        break;
        
      default:
        sendResponse({ error: 'Unknown message type' });
    }
  }

  async syncPlayback({ action, currentTime, timestamp }) {
    if (!this.currentPlayer) return;
    
    this.isControllingPlayback = true;
    const latency = Date.now() - timestamp;
    const adjustedTime = currentTime + (latency / 1000);
    
    console.log(`🔄 Syncing: ${action} at ${adjustedTime}s (latency: ${latency}ms)`);
    
    try {
      switch (action) {
        case 'play':
          if (Math.abs(this.currentPlayer.currentTime - adjustedTime) > 1) {
            this.currentPlayer.currentTime = adjustedTime;
          }
          await this.currentPlayer.play();
          break;
          
        case 'pause':
          this.currentPlayer.pause();
          if (Math.abs(this.currentPlayer.currentTime - currentTime) > 1) {
            this.currentPlayer.currentTime = currentTime;
          }
          break;
          
        case 'seek':
          this.currentPlayer.currentTime = currentTime;
          break;
      }
      
      this.showSyncStatus(`Synced: ${action}`);
    } catch (error) {
      console.error('❌ Sync failed:', error);
    } finally {
      setTimeout(() => {
        this.isControllingPlayback = false;
      }, 500);
    }
  }

  getPlayerState() {
    if (!this.currentPlayer) {
      return { error: 'No player detected' };
    }
    
    return {
      currentTime: this.currentPlayer.currentTime,
      paused: this.currentPlayer.paused,
      duration: this.currentPlayer.duration,
      platform: this.platform,
      url: window.location.href,
      title: document.title
    };
  }

  createSyncButton(platform) {
    // Remove existing button
    const existing = document.getElementById('ustoo-sync-button');
    if (existing) existing.remove();
    
    const button = document.createElement('div');
    button.id = 'ustoo-sync-button';
    button.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 999999;
        background: linear-gradient(135deg, #ec4899, #8b5cf6);
        color: white;
        padding: 12px 16px;
        border-radius: 25px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255,255,255,0.2);
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        gap: 8px;
      " onclick="chrome.runtime.sendMessage({type: 'OPEN_POPUP'})">
        <span style="font-size: 16px;">💕</span>
        <span>UsTwo Sync</span>
        <span style="font-size: 10px; opacity: 0.8;">${platform}</span>
      </div>
    `;
    
    document.body.appendChild(button);
    
    // Add hover effects
    const syncButton = button.firstElementChild;
    syncButton.addEventListener('mouseenter', () => {
      syncButton.style.transform = 'translateY(-2px)';
      syncButton.style.boxShadow = '0 12px 40px rgba(0,0,0,0.4)';
    });
    
    syncButton.addEventListener('mouseleave', () => {
      syncButton.style.transform = 'translateY(0)';
      syncButton.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3)';
    });
  }

  showSyncStatus(message) {
    // Remove existing status
    const existing = document.getElementById('ustoo-sync-status');
    if (existing) existing.remove();
    
    const status = document.createElement('div');
    status.id = 'ustoo-sync-status';
    status.innerHTML = `
      <div style="
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 999999;
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 12px 20px;
        border-radius: 20px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        font-size: 14px;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255,255,255,0.1);
        animation: ustooFadeIn 0.3s ease;
      ">
        ${message}
      </div>
    `;
    
    // Add CSS animation
    if (!document.getElementById('ustoo-animations')) {
      const style = document.createElement('style');
      style.id = 'ustoo-animations';
      style.textContent = `
        @keyframes ustooFadeIn {
          from { opacity: 0; transform: translateX(-50%) translateY(20px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(status);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
      if (status.parentNode) {
        status.style.opacity = '0';
        setTimeout(() => status.remove(), 300);
      }
    }, 3000);
  }
}

// Initialize the controller
new VideoPlayerController();