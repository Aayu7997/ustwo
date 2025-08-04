import React, { useRef, useEffect, useState, useCallback } from 'react';
import Plyr from 'plyr';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { useSmartSync } from '@/hooks/useSmartSync';
import { useRoomPresence } from '@/hooks/useRoomPresence';
import { MediaSourceSelector } from './MediaSourceSelector';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Users, 
  Wifi,
  WifiOff,
  Heart,
  RotateCcw
} from 'lucide-react';
import 'plyr/dist/plyr.css';

interface MediaSource {
  type: 'local' | 'url' | 'ott';
  url?: string;
  file?: File;
  title?: string;
}

interface EnhancedMediaPlayerProps {
  roomId: string;
  onPlaybackStateChange?: (state: any) => void;
}

export const EnhancedMediaPlayer: React.FC<EnhancedMediaPlayerProps> = ({
  roomId,
  onPlaybackStateChange
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<Plyr | null>(null);
  const [mediaSource, setMediaSource] = useState<MediaSource | null>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'drift'>('synced');
  const [heartAnimation, setHeartAnimation] = useState(false);
  const [showSourceSelector, setShowSourceSelector] = useState(true);

  const { presenceUsers, partnerJoined, currentPartner, updateStatus } = useRoomPresence(roomId);

  const handlePlaybackUpdate = useCallback((data: any) => {
    if (!playerRef.current || !isPlayerReady) return;

    const player = playerRef.current;
    const currentTime = player.currentTime;
    const timeDiff = Math.abs(currentTime - data.current_time_seconds);

    if (timeDiff > 1) {
      setSyncStatus('syncing');
      player.currentTime = data.current_time_seconds;
      
      setTimeout(() => setSyncStatus('synced'), 1000);
    }

    if (data.is_playing !== !player.paused) {
      if (data.is_playing) {
        player.play();
      } else {
        player.pause();
      }
    }

    onPlaybackStateChange?.(data);
  }, [isPlayerReady, onPlaybackStateChange]);

  const handleMediaSync = useCallback((data: any) => {
    setSyncStatus('syncing');
    setTimeout(() => setSyncStatus('synced'), 500);
  }, []);

  const handleSyncEvent = useCallback((event: any) => {
    if (!playerRef.current || !isPlayerReady) return;

    const player = playerRef.current;
    
    switch (event.type) {
      case 'play':
        updateStatus('watching');
        player.play();
        break;
      case 'pause':
        updateStatus('paused');
        player.pause();
        break;
      case 'seek':
        player.currentTime = event.currentTime;
        updateStatus('watching');
        break;
      case 'buffering':
        updateStatus('buffering');
        break;
      case 'heart':
        triggerHeartAnimation();
        break;
    }
  }, [isPlayerReady, updateStatus]);

  const { sendPlaybackUpdate, sendSyncEvent } = useRealtimeSync({
    roomId,
    onPlaybackUpdate: handlePlaybackUpdate,
    onMediaSync: handleMediaSync,
    onSyncEvent: handleSyncEvent
  });

  const { metrics, isAutoSyncing, onBuffering, updateSyncTime, resetMetrics } = useSmartSync({
    onResync: () => {
      setSyncStatus('syncing');
      if (playerRef.current) {
        sendSyncEvent('seek', playerRef.current.currentTime, !playerRef.current.paused);
      }
    },
    getCurrentTime: () => playerRef.current?.currentTime || 0,
    isPlaying: () => !playerRef.current?.paused
  });

  const triggerHeartAnimation = () => {
    setHeartAnimation(true);
    setTimeout(() => setHeartAnimation(false), 1000);
  };

  const sendHeart = () => {
    sendSyncEvent('heart', playerRef.current?.currentTime || 0, !playerRef.current?.paused);
    triggerHeartAnimation();
  };

  const initializePlayer = useCallback(() => {
    if (!videoRef.current || !mediaSource?.url) return;

    // Destroy existing player
    if (playerRef.current) {
      playerRef.current.destroy();
    }

    const player = new Plyr(videoRef.current, {
      controls: [
        'play-large',
        'restart',
        'rewind',
        'play',
        'fast-forward',
        'progress',
        'current-time',
        'duration',
        'mute',
        'volume',
        'captions',
        'settings',
        'pip',
        'airplay',
        'fullscreen'
      ],
      settings: ['captions', 'quality', 'speed'],
      quality: {
        default: 720,
        options: [4320, 2880, 2160, 1440, 1080, 720, 576, 480, 360, 240]
      },
      speed: {
        selected: 1,
        options: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
      }
    });

    player.on('ready', () => {
      setIsPlayerReady(true);
      setConnectionStatus('connected');
      updateStatus('idle');
      console.log('Player ready');
    });

    player.on('play', () => {
      updateStatus('watching');
      updateSyncTime(player.currentTime);
      sendPlaybackUpdate(player.currentTime, true);
      sendSyncEvent('play', player.currentTime, true);
    });

    player.on('pause', () => {
      updateStatus('paused');
      sendPlaybackUpdate(player.currentTime, false);
      sendSyncEvent('pause', player.currentTime, false);
    });

    player.on('seeked', () => {
      updateStatus('watching');
      updateSyncTime(player.currentTime);
      sendPlaybackUpdate(player.currentTime, !player.paused);
      sendSyncEvent('seek', player.currentTime, !player.paused);
    });

    player.on('waiting', () => {
      updateStatus('buffering');
      onBuffering();
    });

    player.on('canplay', () => {
      updateStatus(!player.paused ? 'watching' : 'paused');
    });

    player.on('playing', () => {
      updateStatus('watching');
    });

    // Periodic sync every 5 seconds
    const syncInterval = setInterval(() => {
      if (player && !player.paused) {
        sendPlaybackUpdate(player.currentTime, true);
      }
    }, 5000);

    playerRef.current = player;

    return () => {
      clearInterval(syncInterval);
      if (player) {
        player.destroy();
      }
    };
  }, [mediaSource, sendPlaybackUpdate, sendSyncEvent, updateStatus, updateSyncTime, onBuffering]);

  useEffect(() => {
    if (mediaSource) {
      const cleanup = initializePlayer();
      return cleanup;
    }
  }, [initializePlayer]);

  const handleMediaSelect = (source: MediaSource) => {
    setMediaSource(source);
    setShowSourceSelector(false);
    resetMetrics();
  };

  const resetPlayer = () => {
    setMediaSource(null);
    setShowSourceSelector(true);
    setIsPlayerReady(false);
    setConnectionStatus('disconnected');
    setSyncStatus('synced');
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }
  };

  if (showSourceSelector) {
    return (
      <div className="space-y-6">
        <MediaSourceSelector onMediaSelect={handleMediaSelect} roomId={roomId} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {connectionStatus === 'connected' ? (
                  <Wifi className="w-4 h-4 text-green-500" />
                ) : (
                  <WifiOff className="w-4 h-4 text-red-500" />
                )}
                <span className="text-sm font-medium capitalize">{connectionStatus}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span className="text-sm">{presenceUsers.length} connected</span>
              </div>
              
              <Badge variant={syncStatus === 'synced' ? 'default' : 'secondary'}>
                {syncStatus === 'syncing' && isAutoSyncing ? 'Auto-syncing...' : syncStatus}
              </Badge>
              
              {currentPartner && (
                <Badge variant="outline">
                  Partner: {currentPartner.status}
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={sendHeart}
                className="text-pink-500 hover:text-pink-600"
              >
                <Heart className={`w-4 h-4 ${heartAnimation ? 'animate-ping' : ''}`} />
              </Button>
              
              <Button variant="ghost" size="sm" onClick={resetPlayer}>
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {/* Sync Metrics */}
          {metrics.latency > 0 && (
            <div className="mt-3 grid grid-cols-4 gap-4 text-xs text-muted-foreground">
              <div>Latency: {metrics.latency}ms</div>
              <div>Jitter: {metrics.jitter.toFixed(1)}ms</div>
              <div>Drift: {metrics.syncDrift.toFixed(2)}s</div>
              <div>Buffer Events: {metrics.bufferingEvents}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Media Player */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative"
      >
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="relative">
              <video
                ref={videoRef}
                src={mediaSource?.url}
                className="w-full h-auto"
                crossOrigin="anonymous"
                playsInline
              />
              
              {/* Heart Animation Overlay */}
              <AnimatePresence>
                {heartAnimation && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1.5, opacity: 1 }}
                    exit={{ scale: 2, opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
                  >
                    <Heart className="w-16 h-16 text-pink-500 fill-pink-500" />
                  </motion.div>
                )}
              </AnimatePresence>
              
              {/* Loading Overlay */}
              {!isPlayerReady && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="text-center text-white">
                    <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p>Loading player...</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Media Info */}
            {mediaSource && (
              <div className="p-4 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{mediaSource.title}</h3>
                    <p className="text-sm text-muted-foreground capitalize">
                      {mediaSource.type} source
                    </p>
                  </div>
                  {partnerJoined && (
                    <Badge variant="default" className="bg-green-500">
                      Partner joined!
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};