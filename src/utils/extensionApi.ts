// Extension API utilities for web app communication

// Type declarations for Chrome extension API
declare global {
  interface Window {
    chrome?: {
      runtime?: {
        sendMessage: (message: any, callback?: (response: any) => void) => void;
        lastError?: { message: string };
      };
    };
  }
}

export interface ExtensionMessage {
  type: string;
  data?: any;
}

export interface ExtensionResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export class ExtensionBridge {
  private static instance: ExtensionBridge;
  private extensionId: string | null = null;
  
  static getInstance(): ExtensionBridge {
    if (!ExtensionBridge.instance) {
      ExtensionBridge.instance = new ExtensionBridge();
    }
    return ExtensionBridge.instance;
  }

  private constructor() {
    this.detectExtension();
  }

  private async detectExtension() {
    // Check if extension is installed by trying to communicate
    if (typeof window !== 'undefined' && window.chrome?.runtime) {
      try {
        // Try to ping the extension
        await this.sendMessage({ type: 'PING' });
        console.log('✅ UsTwo Extension detected');
      } catch (error) {
        console.log('❌ UsTwo Extension not found');
      }
    }
  }

  async sendMessage(message: ExtensionMessage): Promise<ExtensionResponse> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.chrome?.runtime) {
        reject(new Error('Chrome extension API not available'));
        return;
      }

      window.chrome.runtime.sendMessage(message, (response) => {
        if (window.chrome?.runtime?.lastError) {
          reject(window.chrome.runtime.lastError);
        } else {
          resolve(response || { success: false, error: 'No response' });
        }
      });
    });
  }

  async isExtensionInstalled(): Promise<boolean> {
    try {
      const response = await this.sendMessage({ type: 'PING' });
      return response.success;
    } catch {
      return false;
    }
  }

  async sendUserSession(session: any): Promise<boolean> {
    try {
      const response = await this.sendMessage({
        type: 'SET_USER_SESSION',
        data: session
      });
      return response.success;
    } catch (error) {
      console.error('Failed to send user session to extension:', error);
      return false;
    }
  }

  async sendRoomInfo(room: any): Promise<boolean> {
    try {
      const response = await this.sendMessage({
        type: 'SET_ROOM_INFO',
        data: room
      });
      return response.success;
    } catch (error) {
      console.error('Failed to send room info to extension:', error);
      return false;
    }
  }

  async requestExtensionInstall(): Promise<void> {
    // Show a modal or notification asking user to install extension
    const shouldInstall = confirm(
      'To sync video playback across streaming platforms, please install the UsTwo Chrome Extension.\n\n' +
      'Would you like to be redirected to the Chrome Web Store?'
    );

    if (shouldInstall) {
      // In a real scenario, this would be the actual Chrome Web Store URL
      window.open('chrome-extension://extension-id', '_blank');
    }
  }
}

// Utility functions for the web app
export const extensionBridge = ExtensionBridge.getInstance();

export const checkExtensionAndSync = async (userSession: any, room: any) => {
  const isInstalled = await extensionBridge.isExtensionInstalled();
  
  if (!isInstalled) {
    console.log('🔌 Extension not installed, showing install prompt');
    return false;
  }

  // Send session and room info to extension
  await extensionBridge.sendUserSession(userSession);
  if (room) {
    await extensionBridge.sendRoomInfo(room);
  }

  return true;
};

// Extension download instructions component data
export const extensionInfo = {
  name: 'UsTwo - OTT Sync',
  description: 'Sync video playback with your partner across Netflix, Prime Video, Hotstar, YouTube and more',
  platforms: [
    'Netflix',
    'Prime Video', 
    'Disney+ Hotstar',
    'YouTube',
    'Hulu',
    'Disney+',
    'HBO Max',
    'Crunchyroll'
  ],
  features: [
    'Real-time playback synchronization',
    'Automatic platform detection',
    'Secure room-based connections',
    'Cross-platform compatibility',
    'Low-latency sync (< 1 second)',
    'Works with existing subscriptions'
  ],
  requirements: [
    'Chrome Browser (Version 88+)',
    'UsTwo account',
    'Active subscription to streaming platform'
  ]
};