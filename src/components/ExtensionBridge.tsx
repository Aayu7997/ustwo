import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Chrome, 
  Monitor, 
  Wifi, 
  WifiOff, 
  PlayCircle, 
  PauseCircle,
  Download,
  ExternalLink
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface ExtensionState {
  isInstalled: boolean;
  isConnected: boolean;
  currentSite?: string;
  roomCode?: string;
  playerState?: {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    title?: string;
  };
}

interface ExtensionBridgeProps {
  roomId: string;
  roomCode: string;
}

export const ExtensionBridge: React.FC<ExtensionBridgeProps> = ({
  roomId,
  roomCode
}) => {
  const [extensionState, setExtensionState] = useState<ExtensionState>({
    isInstalled: false,
    isConnected: false
  });
  const [inputRoomCode, setInputRoomCode] = useState(roomCode);

  useEffect(() => {
    checkExtensionInstallation();
    setupMessageListener();
  }, []);

  const checkExtensionInstallation = () => {
    // Check if extension is installed by trying to communicate with it
    const extensionId = 'your-extension-id'; // Replace with actual extension ID
    
    if (typeof (window as any).chrome !== 'undefined' && (window as any).chrome.runtime) {
      (window as any).chrome.runtime.sendMessage(extensionId, { type: 'PING' }, (response: any) => {
        if ((window as any).chrome.runtime.lastError) {
          setExtensionState(prev => ({ ...prev, isInstalled: false }));
        } else {
          setExtensionState(prev => ({ 
            ...prev, 
            isInstalled: true,
            isConnected: response?.connected || false
          }));
        }
      });
    } else {
      // Fallback: check for extension-injected elements
      const injectedElement = document.querySelector('[data-ustw-extension]');
      setExtensionState(prev => ({ 
        ...prev, 
        isInstalled: !!injectedElement 
      }));
    }
  };

  const setupMessageListener = () => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      
      const { type, data } = event.data;
      
      switch (type) {
        case 'USTW_EXTENSION_STATUS':
          setExtensionState(prev => ({
            ...prev,
            isInstalled: true,
            isConnected: data.connected,
            currentSite: data.site
          }));
          break;
          
        case 'USTW_PLAYER_STATE':
          setExtensionState(prev => ({
            ...prev,
            playerState: data
          }));
          break;
          
        case 'USTW_CONNECTION_LOST':
          setExtensionState(prev => ({
            ...prev,
            isConnected: false
          }));
          toast({
            title: "Extension disconnected",
            description: "Lost connection to browser extension",
            variant: "destructive"
          });
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  };

  const connectToExtension = () => {
    window.postMessage({
      type: 'USTW_CONNECT_ROOM',
      data: {
        roomId,
        roomCode: inputRoomCode,
        websocketUrl: `wss://mxatgocmnasozbkbjiuq.supabase.co/realtime/v1`
      }
    }, '*');

    toast({
      title: "Connecting to extension...",
      description: "Check your browser extension popup"
    });
  };

  const sendPlayCommand = () => {
    window.postMessage({
      type: 'USTW_PLAYER_COMMAND',
      data: { command: 'play' }
    }, '*');
  };

  const sendPauseCommand = () => {
    window.postMessage({
      type: 'USTW_PLAYER_COMMAND',
      data: { command: 'pause' }
    }, '*');
  };

  const openExtensionStore = () => {
    window.open('https://chrome.google.com/webstore', '_blank');
  };

  if (!extensionState.isInstalled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Chrome className="w-5 h-5" />
            Chrome Extension Required
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto">
              <Download className="w-10 h-10 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold mb-2">Install UsTwo Extension</h3>
              <p className="text-sm text-muted-foreground mb-4">
                To sync with Netflix, Prime Video, YouTube and other platforms, 
                you need to install our Chrome extension.
              </p>
            </div>
            <Button onClick={openExtensionStore} className="w-full">
              <ExternalLink className="w-4 h-4 mr-2" />
              Install from Chrome Web Store
            </Button>
          </div>
          
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Free and open source</p>
            <p>• Works with Netflix, Prime Video, YouTube, Hotstar</p>
            <p>• No data collection or tracking</p>
            <p>• Automatic video synchronization</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Chrome className="w-5 h-5" />
          Extension Control
          <Badge variant={extensionState.isConnected ? 'default' : 'secondary'}>
            {extensionState.isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!extensionState.isConnected ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="room-code">Room Code</Label>
              <Input
                id="room-code"
                value={inputRoomCode}
                onChange={(e) => setInputRoomCode(e.target.value)}
                placeholder="Enter room code"
              />
            </div>
            
            <Button onClick={connectToExtension} className="w-full">
              <Wifi className="w-4 h-4 mr-2" />
              Connect to Room
            </Button>
            
            <div className="text-sm text-muted-foreground">
              <p>1. Open Netflix, Prime Video, or YouTube</p>
              <p>2. Click the extension icon in your browser</p>
              <p>3. Enter the room code to connect</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4" />
              <span className="text-sm">
                Connected to {extensionState.currentSite || 'OTT Platform'}
              </span>
            </div>
            
            {extensionState.playerState && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {extensionState.playerState.title || 'Video Player'}
                  </span>
                  <Badge variant={extensionState.playerState.isPlaying ? 'default' : 'secondary'}>
                    {extensionState.playerState.isPlaying ? 'Playing' : 'Paused'}
                  </Badge>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={sendPlayCommand}
                    disabled={extensionState.playerState.isPlaying}
                  >
                    <PlayCircle className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={sendPauseCommand}
                    disabled={!extensionState.playerState.isPlaying}
                  >
                    <PauseCircle className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="text-xs text-muted-foreground">
                  {Math.floor(extensionState.playerState.currentTime / 60)}:
                  {Math.floor(extensionState.playerState.currentTime % 60).toString().padStart(2, '0')} / 
                  {Math.floor(extensionState.playerState.duration / 60)}:
                  {Math.floor(extensionState.playerState.duration % 60).toString().padStart(2, '0')}
                </div>
              </div>
            )}
            
            <div className="text-xs text-muted-foreground">
              Extension is syncing your playback with your partner in real-time.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};