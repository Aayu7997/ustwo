import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize,
  SkipBack,
  SkipForward,
  Settings,
  Upload,
  Link,
  Youtube,
  Radio,
  Loader2,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { usePrecisionSync, SyncState } from '@/hooks/usePrecisionSync';
import { useMediaStreaming } from '@/hooks/useMediaStreaming';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface UnifiedVideoPlayerProps {
  roomId: string;
  roomCode?: string;
  isHost: boolean;
  partnerId?: string | null;
  onPlaybackStateChange?: (state: any) => void;
}

type SourceType = 'youtube' | 'url' | 'local' | 'stream';

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Extract YouTube video ID
const getYouTubeId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

export const UnifiedVideoPlayer: React.FC<UnifiedVideoPlayerProps> = ({
  roomId,
  roomCode,
  isHost,
  partnerId,
  onPlaybackStateChange
}) => {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const youtubePlayerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [sourceType, setSourceType] = useState<SourceType>('youtube');
  const [sourceUrl, setSourceUrl] = useState('');
  const [youtubeId, setYoutubeId] = useState<string | null>(null);
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [localBlobUrl, setLocalBlobUrl] = useState<string | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');

  // Sync hook
  const {
    syncStatus,
    broadcastSync,
    forceSeek,
    startPeriodicSync,
    stopPeriodicSync,
    shouldSeek,
    fetchInitialState,
    markPlayerReady,
    DRIFT_THRESHOLD
  } = usePrecisionSync({
    roomId,
    isHost,
    onSyncReceived: (state) => {
      // Apply sync from host
      if (!isHost && state) {
        applySyncState(state);
      }
    }
  });

  // Streaming hook for P2P
  const {
    isStreaming,
    isReceiving,
    remoteStream,
    startStreaming,
    stopStreaming,
    remoteVideoRef
  } = useMediaStreaming({ roomId, roomCode });

  // Apply sync state from host
  const applySyncState = useCallback((state: SyncState) => {
    if (isHost) return;

    console.log('[Player] Applying sync:', state);

    if (videoRef.current) {
      const localTime = videoRef.current.currentTime;
      
      if (shouldSeek(localTime, state.currentTime)) {
        videoRef.current.currentTime = state.currentTime;
      }

      if (state.status === 'play' && videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      } else if (state.status === 'pause' && !videoRef.current.paused) {
        videoRef.current.pause();
      }
    }

    if (youtubePlayerRef.current) {
      const player = youtubePlayerRef.current;
      try {
        const localTime = player.getCurrentTime?.() || 0;
        
        if (shouldSeek(localTime, state.currentTime)) {
          player.seekTo?.(state.currentTime, true);
        }

        if (state.status === 'play') {
          player.playVideo?.();
        } else {
          player.pauseVideo?.();
        }
      } catch {}
    }

    setIsPlaying(state.status === 'play');
    setCurrentTime(state.currentTime);
  }, [isHost, shouldSeek]);

  // Get current state for sync
  const getCurrentState = useCallback((): Omit<SyncState, 'hostId' | 'updatedAt'> => {
    let time = currentTime;
    
    if (videoRef.current) {
      time = videoRef.current.currentTime;
    } else if (youtubePlayerRef.current?.getCurrentTime) {
      time = youtubePlayerRef.current.getCurrentTime();
    }

    return {
      status: isPlaying ? 'play' : 'pause',
      currentTime: time,
      playbackRate: 1,
      sourceType: sourceType as any,
      sourceUrl: sourceUrl || youtubeId || ''
    };
  }, [currentTime, isPlaying, sourceType, sourceUrl, youtubeId]);

  // Handle play/pause
  const togglePlay = useCallback(async () => {
    const newPlaying = !isPlaying;
    setIsPlaying(newPlaying);

    if (videoRef.current) {
      if (newPlaying) {
        await videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }

    if (youtubePlayerRef.current) {
      if (newPlaying) {
        youtubePlayerRef.current.playVideo?.();
      } else {
        youtubePlayerRef.current.pauseVideo?.();
      }
    }

    // Broadcast if host
    if (isHost) {
      broadcastSync({
        status: newPlaying ? 'play' : 'pause',
        currentTime: getCurrentState().currentTime,
        playbackRate: 1,
        sourceType: sourceType as any,
        sourceUrl: sourceUrl || youtubeId || ''
      });
    }
  }, [isPlaying, isHost, broadcastSync, getCurrentState, sourceType, sourceUrl, youtubeId]);

  // Handle seek
  const handleSeek = useCallback((value: number[]) => {
    const time = value[0];
    setCurrentTime(time);

    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }

    if (youtubePlayerRef.current?.seekTo) {
      youtubePlayerRef.current.seekTo(time, true);
    }

    if (isHost) {
      forceSeek(time);
    }
  }, [isHost, forceSeek]);

  // Load YouTube video
  const loadYouTube = useCallback(async (url: string) => {
    const videoId = getYouTubeId(url);
    if (!videoId) {
      setError('Invalid YouTube URL');
      return;
    }

    setLoading(true);
    setError(null);
    setYoutubeId(videoId);
    setSourceType('youtube');
    setSourceUrl(url);

    // Update room media
    if (isHost) {
      await supabase
        .from('rooms')
        .update({
          current_media_url: url,
          current_media_type: 'youtube'
        })
        .eq('id', roomId);
    }

    setLoading(false);
    markPlayerReady();

    toast({
      title: 'YouTube video loaded',
      description: 'Ready to watch together!'
    });
  }, [isHost, roomId, markPlayerReady]);

  // Load URL video
  const loadUrlVideo = useCallback(async (url: string) => {
    setLoading(true);
    setError(null);
    setSourceType('url');
    setSourceUrl(url);
    setYoutubeId(null);

    if (isHost) {
      await supabase
        .from('rooms')
        .update({
          current_media_url: url,
          current_media_type: 'url'
        })
        .eq('id', roomId);
    }

    setLoading(false);

    toast({
      title: 'Video loaded',
      description: 'Ready to watch together!'
    });
  }, [isHost, roomId]);

  // Handle local file
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setLocalFile(file);
    setSourceType('local');
    
    // Create blob URL for local playback
    const blobUrl = URL.createObjectURL(file);
    setLocalBlobUrl(blobUrl);
    setYoutubeId(null);
    setSourceUrl(blobUrl);

    setLoading(false);

    toast({
      title: 'Local video loaded',
      description: 'Click "Start Streaming" to share with partner'
    });
  }, []);

  // Start P2P streaming
  const handleStartStreaming = useCallback(async () => {
    if (!videoRef.current || !localFile) {
      toast({
        title: 'No video loaded',
        description: 'Please select a video file first',
        variant: 'destructive'
      });
      return;
    }

    const success = await startStreaming(videoRef.current);
    if (success) {
      // Start periodic sync
      startPeriodicSync(getCurrentState);
    }
  }, [localFile, startStreaming, startPeriodicSync, getCurrentState]);

  // Handle video events
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      onPlaybackStateChange?.({
        current_time_seconds: videoRef.current.currentTime,
        is_playing: !videoRef.current.paused
      });
    }
  }, [onPlaybackStateChange]);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      markPlayerReady();
    }
  }, [markPlayerReady]);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    if (isHost) {
      startPeriodicSync(getCurrentState);
    }
  }, [isHost, startPeriodicSync, getCurrentState]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    if (isHost) {
      stopPeriodicSync();
      broadcastSync(getCurrentState());
    }
  }, [isHost, stopPeriodicSync, broadcastSync, getCurrentState]);

  // Load YouTube IFrame API
  useEffect(() => {
    if (!youtubeId) return;

    const loadYouTubeAPI = () => {
      if ((window as any).YT?.Player) {
        initYouTubePlayer();
        return;
      }

      if (!(window as any).onYouTubeIframeAPIReady) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.body.appendChild(tag);
      }

      (window as any).onYouTubeIframeAPIReady = initYouTubePlayer;
    };

    const initYouTubePlayer = () => {
      if (!youtubeId) return;

      youtubePlayerRef.current = new (window as any).YT.Player('youtube-player', {
        videoId: youtubeId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          enablejsapi: 1,
          origin: window.location.origin
        },
        events: {
          onReady: () => {
            setLoading(false);
            markPlayerReady();
            setDuration(youtubePlayerRef.current?.getDuration?.() || 0);
          },
          onStateChange: (event: any) => {
            const state = event.data;
            
            // 1 = playing, 2 = paused
            if (state === 1) {
              setIsPlaying(true);
              if (isHost) {
                startPeriodicSync(getCurrentState);
              }
            } else if (state === 2) {
              setIsPlaying(false);
              if (isHost) {
                stopPeriodicSync();
                broadcastSync(getCurrentState());
              }
            }
          },
          onError: (event: any) => {
            console.error('[YouTube] Error:', event.data);
            setError('YouTube video could not be loaded');
          }
        }
      });
    };

    loadYouTubeAPI();

    return () => {
      if (youtubePlayerRef.current?.destroy) {
        try { youtubePlayerRef.current.destroy(); } catch {}
      }
    };
  }, [youtubeId, isHost, markPlayerReady, startPeriodicSync, stopPeriodicSync, broadcastSync, getCurrentState]);

  // Update YouTube time periodically
  useEffect(() => {
    if (!youtubeId || !youtubePlayerRef.current) return;

    const interval = setInterval(() => {
      if (youtubePlayerRef.current?.getCurrentTime) {
        const time = youtubePlayerRef.current.getCurrentTime();
        setCurrentTime(time);
        onPlaybackStateChange?.({
          current_time_seconds: time,
          is_playing: isPlaying
        });
      }
    }, 500);

    return () => clearInterval(interval);
  }, [youtubeId, isPlaying, onPlaybackStateChange]);

  // Fetch initial state on mount
  useEffect(() => {
    if (!isHost) {
      fetchInitialState().then((state) => {
        if (state) {
          if (state.sourceType === 'youtube' && state.sourceUrl) {
            loadYouTube(state.sourceUrl);
          } else if (state.sourceUrl) {
            loadUrlVideo(state.sourceUrl);
          }
        }
      });
    }
  }, [isHost, fetchInitialState, loadYouTube, loadUrlVideo]);

  // Volume control
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = isMuted ? 0 : volume;
    }
    if (youtubePlayerRef.current?.setVolume) {
      youtubePlayerRef.current.setVolume(isMuted ? 0 : volume * 100);
    }
  }, [volume, isMuted]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Show receiving stream
  if (isReceiving && remoteStream) {
    return (
      <div ref={containerRef} className="relative aspect-video bg-black rounded-xl overflow-hidden">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-contain"
        />
        <div className="absolute top-4 left-4">
          <Badge variant="secondary" className="bg-green-500/80 text-white">
            <Radio className="w-3 h-3 mr-1 animate-pulse" />
            Receiving Stream
          </Badge>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Source Selection (Host only) */}
      {isHost && (
        <Tabs defaultValue="youtube" className="w-full" onValueChange={(v) => setSourceType(v as SourceType)}>
          <TabsList className="grid grid-cols-3 w-full max-w-md mx-auto">
            <TabsTrigger value="youtube" className="gap-2">
              <Youtube className="w-4 h-4" />
              YouTube
            </TabsTrigger>
            <TabsTrigger value="url" className="gap-2">
              <Link className="w-4 h-4" />
              URL
            </TabsTrigger>
            <TabsTrigger value="local" className="gap-2">
              <Upload className="w-4 h-4" />
              Local
            </TabsTrigger>
          </TabsList>

          <div className="mt-4">
            <TabsContent value="youtube" className="flex gap-2">
              <Input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Paste YouTube URL..."
                className="flex-1"
                onKeyDown={(e) => e.key === 'Enter' && loadYouTube(urlInput)}
              />
              <Button onClick={() => loadYouTube(urlInput)}>Load</Button>
            </TabsContent>

            <TabsContent value="url" className="flex gap-2">
              <Input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Paste video URL (MP4, WebM)..."
                className="flex-1"
                onKeyDown={(e) => e.key === 'Enter' && loadUrlVideo(urlInput)}
              />
              <Button onClick={() => loadUrlVideo(urlInput)}>Load</Button>
            </TabsContent>

            <TabsContent value="local" className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {localFile ? localFile.name : 'Select Video File'}
                </Button>
                {localFile && !isStreaming && (
                  <Button onClick={handleStartStreaming}>
                    <Radio className="w-4 h-4 mr-2" />
                    Start Streaming
                  </Button>
                )}
                {isStreaming && (
                  <Button variant="destructive" onClick={stopStreaming}>
                    Stop Stream
                  </Button>
                )}
              </div>
              {isStreaming && (
                <Badge variant="secondary" className="bg-green-500/80 text-white">
                  <Radio className="w-3 h-3 mr-1 animate-pulse" />
                  Streaming to Partner
                </Badge>
              )}
            </TabsContent>
          </div>
        </Tabs>
      )}

      {/* Video Player */}
      <div
        ref={containerRef}
        className="relative aspect-video bg-black rounded-xl overflow-hidden group"
        onMouseMove={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
      >
        {/* Loading */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20">
            <AlertCircle className="w-10 h-10 text-destructive mb-2" />
            <p className="text-white">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-4"
              onClick={() => setError(null)}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        )}

        {/* YouTube Player */}
        {youtubeId && (
          <div id="youtube-player" className="w-full h-full" />
        )}

        {/* HTML5 Video */}
        {!youtubeId && (sourceUrl || localBlobUrl) && (
          <video
            ref={videoRef}
            src={localBlobUrl || sourceUrl}
            className="w-full h-full object-contain"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={handlePlay}
            onPause={handlePause}
            onError={() => setError('Video could not be loaded')}
            crossOrigin="anonymous"
            playsInline
          />
        )}

        {/* Placeholder */}
        {!youtubeId && !sourceUrl && !localBlobUrl && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Youtube className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">
              {isHost ? 'Select a video source above' : 'Waiting for host to select a video...'}
            </p>
          </div>
        )}

        {/* Sync Status Badge */}
        {!isHost && (
          <div className="absolute top-4 right-4 z-10">
            <Badge 
              variant="secondary" 
              className={cn(
                "text-white",
                syncStatus === 'synced' && "bg-green-500/80",
                syncStatus === 'syncing' && "bg-yellow-500/80",
                syncStatus === 'out_of_sync' && "bg-red-500/80"
              )}
            >
              {syncStatus === 'synced' && '● Synced'}
              {syncStatus === 'syncing' && '○ Syncing...'}
              {syncStatus === 'out_of_sync' && '○ Reconnecting...'}
            </Badge>
          </div>
        )}

        {/* Controls */}
        <AnimatePresence>
          {(showControls || !isPlaying) && (youtubeId || sourceUrl || localBlobUrl) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4"
            >
              {/* Progress Bar */}
              <div className="mb-3">
                <Slider
                  value={[currentTime]}
                  max={duration || 100}
                  step={0.1}
                  onValueChange={handleSeek}
                  className="cursor-pointer"
                  disabled={!isHost}
                />
                <div className="flex justify-between text-xs text-white/70 mt-1">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Control Buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* Play/Pause */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={togglePlay}
                    disabled={!isHost}
                    className="text-white hover:bg-white/20"
                  >
                    {isPlaying ? (
                      <Pause className="w-5 h-5" />
                    ) : (
                      <Play className="w-5 h-5" />
                    )}
                  </Button>

                  {/* Skip buttons */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleSeek([Math.max(0, currentTime - 10)])}
                    disabled={!isHost}
                    className="text-white hover:bg-white/20"
                  >
                    <SkipBack className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleSeek([Math.min(duration, currentTime + 10)])}
                    disabled={!isHost}
                    className="text-white hover:bg-white/20"
                  >
                    <SkipForward className="w-4 h-4" />
                  </Button>

                  {/* Volume */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsMuted(!isMuted)}
                    className="text-white hover:bg-white/20"
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </Button>
                  <Slider
                    value={[isMuted ? 0 : volume]}
                    max={1}
                    step={0.1}
                    onValueChange={(v) => {
                      setVolume(v[0]);
                      setIsMuted(v[0] === 0);
                    }}
                    className="w-20"
                  />
                </div>

                <div className="flex items-center gap-2">
                  {/* Host indicator */}
                  {isHost && (
                    <Badge variant="outline" className="text-white border-white/30">
                      Host
                    </Badge>
                  )}

                  {/* Fullscreen */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleFullscreen}
                    className="text-white hover:bg-white/20"
                  >
                    {isFullscreen ? (
                      <Minimize className="w-4 h-4" />
                    ) : (
                      <Maximize className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Click to play overlay */}
        {!isPlaying && (youtubeId || sourceUrl || localBlobUrl) && !loading && (
          <div 
            className="absolute inset-0 flex items-center justify-center cursor-pointer z-10"
            onClick={togglePlay}
          >
            <motion.div
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="w-20 h-20 rounded-full bg-primary/90 flex items-center justify-center shadow-lg"
            >
              <Play className="w-10 h-10 text-white ml-1" />
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};
