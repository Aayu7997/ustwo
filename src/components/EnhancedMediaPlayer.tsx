import React, { useRef, useEffect, useState, useCallback } from 'react';
import Plyr from 'plyr';
import Hls from 'hls.js';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { useSmartSync } from '@/hooks/useSmartSync';
import { useRoomPresence } from '@/hooks/useRoomPresence';
import { useWebTorrent } from '@/hooks/useWebTorrent';
import { FileUploadHandler } from './FileUploadHandler';
import { YouTubePlayer } from './YouTubePlayer';
import { 
  Play, 
  Users, 
  Wifi,
  WifiOff,
  Heart,
  Upload,
  AlertTriangle,
  Volume2,
  VolumeX
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import 'plyr/dist/plyr.css';

interface MediaSource {
  type: 'local' | 'url' | 'shared' | 'youtube' | 'hls' | 'p2p';
  url: string;
  file?: File;
  fileId?: string;
  title: string;
  magnetURI?: string;
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
  const hlsRef = useRef<Hls | null>(null);
  const [mediaSource, setMediaSource] = useState<MediaSource | null>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'drift'>('synced');
  const [heartAnimation, setHeartAnimation] = useState(false);
  const [showSourceSelector, setShowSourceSelector] = useState(true);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const { presenceUsers, partnerJoined, currentPartner, updateStatus } = useRoomPresence(roomId);
  const { seedFile, downloadFromMagnet, isSeeding, isDownloading, downloadProgress } = useWebTorrent();

  const detectMediaType = (url: string): MediaSource['type'] => {
    const urlLower = url.toLowerCase();
    
    if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
      return 'youtube';
    }
    
    if (urlLower.includes('.m3u8') || urlLower.includes('hls')) {
      return 'hls';
    }
    
    return 'url';
  };

  const extractYouTubeId = (url: string): string | null => {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  const handlePlaybackUpdate = useCallback((data: any) => {
    if (!isPlayerReady) return;

    const currentTime = getCurrentTime();
    const timeDiff = Math.abs(currentTime - data.current_time_seconds);

    if (timeDiff > 1) {
      setSyncStatus('syncing');
      seekTo(data.current_time_seconds);
      setTimeout(() => setSyncStatus('synced'), 1000);
    }

    if (data.is_playing !== isPlaying()) {
      if (data.is_playing) {
        playMedia();
      } else {
        pauseMedia();
      }
    }

    onPlaybackStateChange?.(data);
  }, [isPlayerReady, onPlaybackStateChange]);

  const getCurrentTime = (): number => {
    if (mediaSource?.type === 'youtube') {
      // YouTube player integration would go here
      return 0;
    }
    return playerRef.current?.currentTime || 0;
  };

  const isPlaying = (): boolean => {
    if (mediaSource?.type === 'youtube') {
      // YouTube player integration would go here
      return false;
    }
    return !playerRef.current?.paused;
  };

  const seekTo = (time: number) => {
    if (mediaSource?.type === 'youtube') {
      // YouTube player integration would go here
      return;
    }
    if (playerRef.current) {
      playerRef.current.currentTime = time;
    }
  };

  const playMedia = async () => {
    if (mediaSource?.type === 'youtube') {
      // YouTube player integration would go here
      return;
    }
    
    if (playerRef.current) {
      try {
        await playerRef.current.play();
      } catch (error) {
        // Handle autoplay blocking
        if (isMuted) {
          toast({
            title: "Autoplay blocked",
            description: "Click the play button to start playback",
            variant: "destructive"
          });
        } else {
          setIsMuted(true);
          if (videoRef.current) {
            videoRef.current.muted = true;
          }
          try {
            await playerRef.current.play();
            toast({
              title: "Playing muted",
              description: "Video started muted due to browser policy. Click to unmute.",
            });
          } catch {
            toast({
              title: "Autoplay blocked",
              description: "Click the play button to start playback",
              variant: "destructive"
            });
          }
        }
      }
    }
  };

  const pauseMedia = () => {
    if (mediaSource?.type === 'youtube') {
      // YouTube player integration would go here
      return;
    }
    playerRef.current?.pause();
  };

  const handleMediaSync = useCallback((data: any) => {
    setSyncStatus('syncing');
    setTimeout(() => setSyncStatus('synced'), 500);
  }, []);

  const handleSyncEvent = useCallback((event: any) => {
    if (!isPlayerReady) return;
    
    switch (event.type) {
      case 'play':
        updateStatus('watching');
        playMedia();
        break;
      case 'pause':
        updateStatus('paused');
        pauseMedia();
        break;
      case 'seek':
        seekTo(event.currentTime);
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
      const currentTime = getCurrentTime();
      const playing = isPlaying();
      sendSyncEvent('seek', currentTime, playing);
    },
    getCurrentTime,
    isPlaying
  });

  const triggerHeartAnimation = () => {
    setHeartAnimation(true);
    setTimeout(() => setHeartAnimation(false), 1000);
  };

  const sendHeart = () => {
    const currentTime = getCurrentTime();
    const playing = isPlaying();
    sendSyncEvent('heart', currentTime, playing);
    triggerHeartAnimation();
  };

  const setupHLS = useCallback((url: string) => {
    if (!videoRef.current) return;

    // Clean up existing HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90
      });

      hls.loadSource(url);
      hls.attachMedia(videoRef.current);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('HLS manifest parsed');
        setPlaybackError(null);
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS error:', data);
        if (data.fatal) {
          setPlaybackError(`HLS Error: ${data.details}`);
        }
      });

      hlsRef.current = hls;
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS support
      videoRef.current.src = url;
    } else {
      setPlaybackError('HLS not supported in this browser');
    }
  }, []);

  const initializePlayer = useCallback(() => {
    if (!videoRef.current || !mediaSource?.url) return;

    setPlaybackError(null);

    if (playerRef.current) {
      playerRef.current.destroy();
    }

    // Handle different media types
    if (mediaSource.type === 'hls') {
      setupHLS(mediaSource.url);
    } else {
      // Standard video setup
      videoRef.current.src = mediaSource.url;
      videoRef.current.crossOrigin = 'anonymous';
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

    player.on('error', (event) => {
      console.error('Plyr error:', event);
      const error = videoRef.current?.error;
      if (error) {
        let errorMessage = 'Unknown playback error';
        switch (error.code) {
          case 1:
            errorMessage = 'Video loading aborted';
            break;
          case 2:
            errorMessage = 'Network error';
            break;
          case 3:
            errorMessage = 'Video format not supported';
            break;
          case 4:
            errorMessage = 'Video not found';
            break;
        }
        setPlaybackError(errorMessage);
      }
    });

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
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, [mediaSource, sendPlaybackUpdate, sendSyncEvent, updateStatus, updateSyncTime, onBuffering, setupHLS]);

  useEffect(() => {
    if (mediaSource && mediaSource.type !== 'youtube') {
      const cleanup = initializePlayer();
      return cleanup;
    }
  }, [initializePlayer]);

  const handleFileSelect = async (file: File, url: string) => {
    const mediaType = detectMediaType(file.name);
    
    console.log('Selected file:', file.name, 'Size:', file.size, 'Type:', file.type);
    
    setMediaSource({
      type: 'local',
      url,
      file,
      title: file.name
    });
    setShowSourceSelector(false);
    resetMetrics();
    
    // Show success message
    toast({
      title: "Media Loaded! 🎬",
      description: `Playing ${file.name} locally`
    });
  };

  const handleUrlSubmit = (url: string) => {
    const mediaType = detectMediaType(url);
    
    console.log('Loading URL:', url, 'Detected type:', mediaType);
    
    setMediaSource({
      type: mediaType,
      url,
      title: extractTitleFromUrl(url)
    });
    setShowSourceSelector(false);
    resetMetrics();
    
    // Show success message
    toast({
      title: "Media Source Added! 🎬",
      description: `Loading ${mediaType === 'youtube' ? 'YouTube video' : mediaType === 'hls' ? 'HLS stream' : 'video'}`
    });
  };

  const handleSharedFileSelect = (fileId: string, url: string, fileName: string) => {
    setMediaSource({
      type: 'shared',
      url,
      fileId,
      title: fileName
    });
    setShowSourceSelector(false);
    resetMetrics();
  };

  const extractTitleFromUrl = (url: string): string => {
    try {
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        const videoId = extractYouTubeId(url);
        return videoId ? `YouTube Video (${videoId})` : 'YouTube Video';
      }
      
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop() || 'Video';
      return filename.replace(/\.[^/.]+$/, '');
    } catch {
      return 'Video';
    }
  };

  const resetPlayer = () => {
    setMediaSource(null);
    setShowSourceSelector(true);
    setIsPlayerReady(false);
    setConnectionStatus('disconnected');
    setSyncStatus('synced');
    setPlaybackError(null);
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  };

  if (showSourceSelector) {
    return (
      <div className="space-y-6">
        <FileUploadHandler
          roomId={roomId}
          onFileSelect={handleFileSelect}
          onUrlSubmit={handleUrlSubmit}
          onSharedFileSelect={handleSharedFileSelect}
        />
      </div>
    );
  }

  // YouTube player rendering
  if (mediaSource?.type === 'youtube') {
    return (
      <div className="space-y-4">
        {/* Status Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Badge variant="default" className="bg-red-500">YouTube</Badge>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span className="text-sm">{presenceUsers.length} connected</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={resetPlayer}>
                  <Upload className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <YouTubePlayer
          videoId={extractYouTubeId(mediaSource.url)!}
          onPlaybackUpdate={(currentTime, isPlaying) => {
            sendPlaybackUpdate(currentTime, isPlaying);
            sendSyncEvent(isPlaying ? 'play' : 'pause', currentTime, isPlaying);
          }}
        />
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

              {mediaSource?.type === 'hls' && (
                <Badge variant="outline">HLS Stream</Badge>
              )}

              {mediaSource?.type === 'p2p' && (
                <Badge variant="outline" className="bg-purple-100 dark:bg-purple-900">
                  P2P Sharing
                </Badge>
              )}
              
              {currentPartner && (
                <Badge variant="outline">
                  Partner: {currentPartner.status}
                </Badge>
              )}

              {(isSeeding || isDownloading) && (
                <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900">
                  {isSeeding ? 'Seeding' : `Downloading ${downloadProgress}%`}
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

              {isMuted && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsMuted(false);
                    if (videoRef.current) {
                      videoRef.current.muted = false;
                    }
                  }}
                  className="text-red-500"
                >
                  <VolumeX className="w-4 h-4" />
                </Button>
              )}
              
              <Button variant="ghost" size="sm" onClick={resetPlayer}>
                <Upload className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {playbackError && (
            <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-medium">Playback Error</span>
              </div>
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">{playbackError}</p>
              <p className="text-xs text-red-500 dark:text-red-500 mt-2">
                Try a different source or use screen sharing as fallback
              </p>
            </div>
          )}

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
                className="w-full h-auto"
                crossOrigin="anonymous"
                playsInline
                muted={isMuted}
              />
              
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
              
              {!isPlayerReady && !playbackError && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="text-center text-white">
                    <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p>Loading player...</p>
                    {mediaSource?.type === 'hls' && (
                      <p className="text-sm mt-2">Setting up HLS stream...</p>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {mediaSource && (
              <div className="p-4 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{mediaSource.title}</h3>
                    <p className="text-sm text-muted-foreground capitalize">
                      {mediaSource.type === 'shared' ? 'Shared file - synced automatically' : 
                       mediaSource.type === 'local' ? 'Local file - sharing with P2P if supported' :
                       mediaSource.type === 'p2p' ? 'P2P shared - streaming directly between devices' :
                       mediaSource.type === 'hls' ? 'HLS stream - synced automatically' :
                       'URL source - synced automatically'}
                    </p>
                  </div>
                  {partnerJoined && (
                    <Badge variant="default" className="bg-green-500">
                      Partner joined! 💕
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