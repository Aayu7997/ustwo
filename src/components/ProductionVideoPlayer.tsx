import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipBack, SkipForward, Upload, Link as LinkIcon,
  Youtube, Radio, Loader2, RefreshCw, Users, Wifi, WifiOff,
  Crown, Heart
} from 'lucide-react';
import Hls from 'hls.js';
import { RobustYouTubePlayer } from '@/components/RobustYouTubePlayer';
import { VimeoPlayer } from '@/components/VimeoPlayer';
import { useHostSync, SyncState } from '@/hooks/useHostSync';
import { useEnhancedStreaming } from '@/hooks/useEnhancedStreaming';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface ProductionVideoPlayerProps {
  roomId: string;
  roomCode?: string;
  isRoomCreator: boolean;
  onPlaybackStateChange?: (state: any) => void;
}

export const ProductionVideoPlayer: React.FC<ProductionVideoPlayerProps> = ({ 
  roomId, 
  roomCode,
  isRoomCreator,
  onPlaybackStateChange 
}) => {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const playerReadyRef = useRef<boolean>(false);
  const pendingSyncRef = useRef<SyncState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const ytControlsRef = useRef<any>(null);
  const vimeoControlsRef = useRef<any>(null);

  // Player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  // Media source states
  const [videoSrc, setVideoSrc] = useState('');
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null);
  const [currentMediaType, setCurrentMediaType] = useState<SyncState['sourceType']>('local');
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [urlInput, setUrlInput] = useState('');

  // Host sync - room creator is host
  const [isHost, setIsHost] = useState(isRoomCreator);

  // Apply sync from host
  const applySyncState = useCallback(async (state: SyncState) => {
    console.log('[ProductionPlayer] Applying sync:', {
      time: state.currentTime.toFixed(1),
      status: state.status,
      sourceType: state.sourceType
    });

    const DRIFT_THRESHOLD = 1.0;

    // Handle media source change
    if (state.sourceUrl && state.sourceType !== currentMediaType) {
      await handleMediaSourceChange(state.sourceUrl, state.sourceType);
    }

    // Apply playback state based on player type
    if (state.sourceType === 'youtube' && ytControlsRef.current) {
      const cur = ytControlsRef.current.getCurrentTime?.() ?? 0;
      if (Math.abs(cur - state.currentTime) > DRIFT_THRESHOLD) {
        ytControlsRef.current.seekTo(state.currentTime);
      }
      if (state.status === 'play') ytControlsRef.current.play();
      else ytControlsRef.current.pause();
    } else if (state.sourceType === 'vimeo' && vimeoControlsRef.current) {
      const cur = await vimeoControlsRef.current.getCurrentTime?.() ?? 0;
      if (Math.abs(cur - state.currentTime) > DRIFT_THRESHOLD) {
        vimeoControlsRef.current.seekTo(state.currentTime);
      }
      if (state.status === 'play') vimeoControlsRef.current.play();
      else vimeoControlsRef.current.pause();
    } else if (videoRef.current) {
      if (Math.abs(videoRef.current.currentTime - state.currentTime) > DRIFT_THRESHOLD) {
        videoRef.current.currentTime = state.currentTime;
      }
      if (state.status === 'play' && videoRef.current.paused) {
        try { await videoRef.current.play(); } 
        catch { setAutoplayBlocked(true); }
      }
      if (state.status === 'pause' && !videoRef.current.paused) {
        videoRef.current.pause();
      }
    }

    setIsPlaying(state.status === 'play');
    setCurrentTime(state.currentTime);
  }, [currentMediaType]);

  // Host sync hook
  const { 
    broadcastSync, 
    startPeriodicSync, 
    stopPeriodicSync,
    fetchInitialState,
    shouldSeek 
  } = useHostSync({
    roomId,
    roomCode,
    isHost,
    onSyncReceived: (state) => {
      if (playerReadyRef.current) {
        applySyncState(state);
      } else {
        pendingSyncRef.current = state;
      }
    }
  });

  // P2P Live Streaming - using enhanced version with proper toggle
  const {
    isStreaming,
    isReceiving,
    remoteStream,
    toggleStreaming,
    stopStreaming
  } = useEnhancedStreaming({ roomId, roomCode, enabled: true });

  // Get current state for sync
  const getCurrentState = useCallback((): Omit<SyncState, 'hostId' | 'updatedAt'> => {
    let time = currentTime;
    
    if (currentMediaType === 'youtube' && ytControlsRef.current) {
      time = ytControlsRef.current.getCurrentTime?.() ?? currentTime;
    } else if (videoRef.current) {
      time = videoRef.current.currentTime;
    }

    return {
      status: isPlaying ? 'play' : 'pause',
      currentTime: time,
      playbackRate: 1,
      sourceType: currentMediaType,
      sourceUrl: currentMediaType === 'youtube' ? (youtubeVideoId || '') : videoSrc
    };
  }, [currentTime, isPlaying, currentMediaType, youtubeVideoId, videoSrc]);

  // Handle media source change
  const handleMediaSourceChange = useCallback(async (url: string, type: SyncState['sourceType']) => {
    console.log('[ProductionPlayer] Media source change:', type, url);
    
    setIsLoading(true);
    playerReadyRef.current = false;

    if (type === 'youtube') {
      setYoutubeVideoId(url);
      setCurrentMediaType('youtube');
      setVideoSrc('');
    } else if (type === 'vimeo') {
      setVideoSrc(url);
      setCurrentMediaType('vimeo');
      setYoutubeVideoId(null);
    } else if (type === 'hls') {
      if (Hls.isSupported() && videoRef.current) {
        if (hlsRef.current) hlsRef.current.destroy();
        hlsRef.current = new Hls();
        hlsRef.current.loadSource(url);
        hlsRef.current.attachMedia(videoRef.current);
      }
      setCurrentMediaType('hls');
      setVideoSrc('');
      setYoutubeVideoId(null);
    } else if (type === 'stream') {
      setCurrentMediaType('stream');
      setVideoSrc('');
      setYoutubeVideoId(null);
    } else {
      setVideoSrc(url);
      setCurrentMediaType(type);
      setYoutubeVideoId(null);
    }
    
    setIsLoading(false);
  }, []);

  // Sync media source to room (host only)
  const syncMediaSource = useCallback(async (url: string, type: string) => {
    if (!isHost) return;
    
    try {
      await supabase
        .from('rooms')
        .update({ current_media_url: url, current_media_type: type })
        .eq('id', roomId);
    } catch (error) {
      console.error('[ProductionPlayer] Failed to sync media:', error);
    }
  }, [roomId, isHost]);

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Extract YouTube ID
  const extractYouTubeId = (url: string): string | null => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  // Load URL
  const handleLoadUrl = async () => {
    if (!urlInput.trim()) return;

    setIsLoading(true);
    playerReadyRef.current = false;

    try {
      const ytId = extractYouTubeId(urlInput);
      if (ytId) {
        setYoutubeVideoId(ytId);
        setCurrentMediaType('youtube');
        setVideoSrc('');
        await syncMediaSource(ytId, 'youtube');
        toast({ title: 'YouTube Video Loaded! 📺' });
        setUrlInput('');
        return;
      }

      const vimeoMatch = urlInput.match(/vimeo\.com\/(?:video\/)?(\d+)/);
      if (vimeoMatch) {
        setVideoSrc(vimeoMatch[1]);
        setCurrentMediaType('vimeo');
        await syncMediaSource(vimeoMatch[1], 'vimeo');
        toast({ title: 'Vimeo Video Loaded! 📺' });
        setUrlInput('');
        return;
      }

      if (urlInput.includes('.m3u8')) {
        if (Hls.isSupported() && videoRef.current) {
          if (hlsRef.current) hlsRef.current.destroy();
          hlsRef.current = new Hls();
          hlsRef.current.loadSource(urlInput);
          hlsRef.current.attachMedia(videoRef.current);
        }
        setCurrentMediaType('hls');
        await syncMediaSource(urlInput, 'hls');
        toast({ title: 'HLS Stream Loaded! 📺' });
        setUrlInput('');
        return;
      }

      setVideoSrc(urlInput);
      setCurrentMediaType('url');
      await syncMediaSource(urlInput, 'url');
      toast({ title: 'Video Loaded! 🎬' });
      setUrlInput('');
    } catch (error) {
      toast({ title: 'Failed to load video', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  // File handling
  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0 || !user) return;

    const file = files[0];
    if (!file.type.startsWith('video/')) {
      toast({ title: "Invalid File Type", description: "Please select a video file", variant: "destructive" });
      return;
    }

    setCurrentFile(file);
    setIsLoading(true);
    playerReadyRef.current = false;

    const blobUrl = URL.createObjectURL(file);
    setVideoSrc(blobUrl);
    setCurrentMediaType('local');
    setYoutubeVideoId(null);
    setIsLoading(false);
    
    toast({
      title: "Video Loaded! 🎬",
      description: `${file.name} - Click "Stream to Partner" to share`
    });
  };

  // Toggle P2P streaming (for local files)
  const handleToggleStreaming = async () => {
    if (!videoRef.current || !currentFile) {
      toast({ title: "No video loaded", description: "Load a local video first", variant: "destructive" });
      return;
    }
    
    const nowStreaming = await toggleStreaming(videoRef.current);
    if (nowStreaming) {
      setCurrentMediaType('stream');
      await syncMediaSource('stream', 'stream');
      toast({ title: "Streaming Started! 📡", description: "Your partner can now see your video" });
    } else {
      toast({ title: "Streaming Stopped", description: "No longer sharing video" });
    }
  };

  // Playback controls - HOST broadcasts, LISTENER applies locally
  const togglePlayPause = useCallback(() => {
    if (currentMediaType === 'youtube' && ytControlsRef.current) {
      if (isPlaying) ytControlsRef.current.pause();
      else ytControlsRef.current.play();
      return;
    }
    if (currentMediaType === 'vimeo' && vimeoControlsRef.current) {
      if (isPlaying) vimeoControlsRef.current.pause();
      else vimeoControlsRef.current.play();
      return;
    }
    if (!videoRef.current) return;
    if (isPlaying) videoRef.current.pause();
    else void videoRef.current.play().catch(() => setAutoplayBlocked(true));
  }, [currentMediaType, isPlaying]);

  const handleSeek = useCallback((value: number[]) => {
    const time = (value[0] / 100) * (duration || 0);
    
    if (currentMediaType === 'youtube' && ytControlsRef.current) {
      ytControlsRef.current.seekTo(time);
    } else if (currentMediaType === 'vimeo' && vimeoControlsRef.current) {
      vimeoControlsRef.current.seekTo(time);
    } else if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
    
    setCurrentTime(time);
    
    // Host broadcasts seek
    if (isHost) {
      broadcastSync({
        ...getCurrentState(),
        currentTime: time
      });
    }
  }, [duration, currentMediaType, isHost, broadcastSync, getCurrentState]);

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume / 100;
      setIsMuted(newVolume === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.volume = isMuted ? volume / 100 : 0;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const skipTime = (seconds: number) => {
    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    
    if (currentMediaType === 'youtube' && ytControlsRef.current) {
      ytControlsRef.current.seekTo(newTime);
    } else if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
    
    setCurrentTime(newTime);
    
    if (isHost) {
      broadcastSync({
        ...getCurrentState(),
        currentTime: newTime
      });
    }
  };

  // Video event handlers
  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    setAutoplayBlocked(false);
    
    if (isHost) {
      startPeriodicSync(getCurrentState);
    }
  }, [isHost, startPeriodicSync, getCurrentState]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    
    if (isHost) {
      stopPeriodicSync();
      broadcastSync({
        ...getCurrentState(),
        status: 'pause'
      });
    }
  }, [isHost, stopPeriodicSync, broadcastSync, getCurrentState]);

  // Video element setup
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onLoadedMetadata = () => {
      setDuration(video.duration);
      playerReadyRef.current = true;
      setIsLoading(false);
      
      if (pendingSyncRef.current) {
        applySyncState(pendingSyncRef.current);
        pendingSyncRef.current = null;
      }
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [applySyncState, handlePlay, handlePause]);

  // Initial state fetch
  useEffect(() => {
    const loadInitialState = async () => {
      const state = await fetchInitialState();
      if (!state) return;
      
      if (state.sourceUrl && state.sourceType) {
        await handleMediaSourceChange(state.sourceUrl, state.sourceType);
      }
      
      pendingSyncRef.current = state;
    };

    loadInitialState();
  }, [roomId, fetchInitialState, handleMediaSourceChange]);

  // Update video source
  useEffect(() => {
    if (videoRef.current && videoSrc && currentMediaType !== 'stream') {
      videoRef.current.src = videoSrc;
    }
  }, [videoSrc, currentMediaType]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (hlsRef.current) hlsRef.current.destroy();
      stopPeriodicSync();
    };
  }, [stopPeriodicSync]);

  // Report playback state
  useEffect(() => {
    onPlaybackStateChange?.({
      is_playing: isPlaying,
      current_time_seconds: currentTime,
      duration_seconds: duration
    });
  }, [isPlaying, currentTime, duration, onPlaybackStateChange]);

  const progressPercent = duration ? (currentTime / duration) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full space-y-6"
    >
      {/* Host/Listener Badge */}
      <div className="flex items-center justify-between">
        <Badge 
          variant={isHost ? "default" : "secondary"} 
          className={cn(
            "gap-2 py-1.5 px-3",
            isHost ? "bg-gradient-romantic text-white" : ""
          )}
        >
          {isHost ? (
            <>
              <Crown className="w-4 h-4" />
              You are the Host (controlling playback)
            </>
          ) : (
            <>
              <Users className="w-4 h-4" />
              Syncing with Host
            </>
          )}
        </Badge>
        
        {isStreaming && (
          <Badge className="bg-red-500 animate-pulse gap-1">
            <Radio className="w-3 h-3" />
            LIVE
          </Badge>
        )}
        
        {isReceiving && (
          <Badge className="bg-green-500 gap-1">
            <Wifi className="w-3 h-3" />
            Receiving Stream
          </Badge>
        )}
      </div>

      {/* Source Selection - Host Only */}
      {isHost && (
        <Card className="p-4 glass-card">
          <Tabs defaultValue="url" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="url" className="gap-2">
                <LinkIcon className="w-4 h-4" />
                URL / YouTube
              </TabsTrigger>
              <TabsTrigger value="file" className="gap-2">
                <Upload className="w-4 h-4" />
                Local File
              </TabsTrigger>
              <TabsTrigger value="stream" className="gap-2">
                <Radio className="w-4 h-4" />
                P2P Stream
              </TabsTrigger>
            </TabsList>

            <TabsContent value="url" className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Paste YouTube, Vimeo, or direct video URL..."
                  className="flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && handleLoadUrl()}
                />
                <Button onClick={handleLoadUrl} disabled={isLoading || !urlInput.trim()}>
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Load'}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="file" className="space-y-4">
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={(e) => handleFileSelect(e.target.files)}
                  className="hidden"
                />
                <Button 
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="flex-1"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Choose Video File
                </Button>
              </div>
              {currentFile && (
                <p className="text-sm text-muted-foreground">
                  Loaded: {currentFile.name}
                </p>
              )}
            </TabsContent>

            <TabsContent value="stream" className="space-y-4">
              <div className="flex gap-2">
                <Button 
                  onClick={handleToggleStreaming}
                  disabled={!currentFile || !videoRef.current}
                  variant={isStreaming ? "destructive" : "default"}
                  className={cn("flex-1", !isStreaming && "bg-gradient-romantic")}
                >
                  {isStreaming ? (
                    <>
                      <WifiOff className="w-4 h-4 mr-2" />
                      Stop Streaming
                    </>
                  ) : (
                    <>
                      <Radio className="w-4 h-4 mr-2" />
                      Stream to Partner
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                P2P streaming shares your local video directly with your partner - no upload needed!
              </p>
            </TabsContent>
          </Tabs>
        </Card>
      )}

      {/* Listener Info */}
      {!isHost && (
        <Card className="p-4 glass-card text-center">
          <p className="text-muted-foreground flex items-center justify-center gap-2">
            <Heart className="w-4 h-4 text-primary" />
            Watching in sync with your partner
          </p>
        </Card>
      )}

      {/* Video Player */}
      <div 
        ref={containerRef}
        className="relative bg-black rounded-xl overflow-hidden shadow-2xl group"
        onMouseEnter={() => setShowControls(true)}
        onMouseMove={() => {
          setShowControls(true);
          if ((window as any).__controlsTimer) clearTimeout((window as any).__controlsTimer);
          (window as any).__controlsTimer = setTimeout(() => { if (isPlaying) setShowControls(false); }, 3000);
        }}
        onMouseLeave={() => { if (isPlaying) setShowControls(false); }}
      >
        {/* Receiving Partner's Stream - shown ON TOP when available */}
        {isReceiving && remoteStream && (
          <div className="w-full aspect-video relative">
            <video
              ref={(el) => {
                if (el && remoteStream) {
                  el.srcObject = remoteStream;
                  el.play().catch(() => {});
                }
              }}
              autoPlay
              playsInline
              controls={false}
              className="w-full h-full object-contain"
            />
            <Badge className="absolute top-4 left-4 bg-green-500/90">
              <Radio className="w-3 h-3 mr-1 animate-pulse" />
              Live from Partner
            </Badge>
          </div>
        )}

        {/* Waiting for stream handshake - show connecting state */}
        {isReceiving && !remoteStream && currentMediaType === 'stream' && !isStreaming && (
          <div className="w-full aspect-video flex items-center justify-center bg-black">
            <div className="text-center text-white/80 space-y-2">
              <Loader2 className="w-8 h-8 animate-spin mx-auto" />
              <p className="text-sm">Connecting to partner's stream…</p>
            </div>
          </div>
        )}

        {/* YouTube Player - keep visible unless receiving a live remote stream */}
        {!(isReceiving && remoteStream) && currentMediaType === 'youtube' && youtubeVideoId && (
          <RobustYouTubePlayer 
            videoId={youtubeVideoId}
            onPlaybackUpdate={(time, playing) => {
              setCurrentTime(time);
              setIsPlaying(playing);
              
              if (isHost) {
                broadcastSync({
                  status: playing ? 'play' : 'pause',
                  currentTime: time,
                  playbackRate: 1,
                  sourceType: 'youtube',
                  sourceUrl: youtubeVideoId
                });
              }
            }}
            onDurationChange={(d) => setDuration(d)}
            onReady={() => {
              playerReadyRef.current = true;
              setIsLoading(false);
              if (pendingSyncRef.current) {
                applySyncState(pendingSyncRef.current);
                pendingSyncRef.current = null;
              }
            }}
            onReadyControls={(api) => { ytControlsRef.current = api; }}
            onError={(err) => toast({ title: 'YouTube Error', description: err, variant: 'destructive' })}
          />
        )}

        {/* Vimeo Player */}
        {!(isReceiving && remoteStream) && currentMediaType === 'vimeo' && (
          <VimeoPlayer 
            videoId={videoSrc}
            onPlaybackUpdate={(time, playing) => {
              setCurrentTime(time);
              setIsPlaying(playing);
              
              if (isHost) {
                broadcastSync({
                  status: playing ? 'play' : 'pause',
                  currentTime: time,
                  playbackRate: 1,
                  sourceType: 'vimeo',
                  sourceUrl: videoSrc
                });
              }
            }}
            onDurationChange={(d) => setDuration(d)}
            onReadyControls={(api) => { 
              vimeoControlsRef.current = api;
              playerReadyRef.current = true;
              setIsLoading(false);
            }}
          />
        )}

        {/* Native Video Player - ALWAYS render (hidden via CSS when not needed) */}
        {currentMediaType !== 'youtube' && currentMediaType !== 'vimeo' && (
          <div className={cn(
            "relative w-full aspect-video",
            // Hide visually when receiving a live remote stream, but keep in DOM
            isReceiving && remoteStream && "hidden"
          )}>
            <video
              ref={videoRef}
              src={videoSrc}
              className="w-full h-full object-contain"
              controls={false}
              playsInline
              crossOrigin="anonymous"
              preload="metadata"
            />
            
            {/* Autoplay blocked overlay */}
            {autoplayBlocked && (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
                <Button 
                  onClick={() => { setAutoplayBlocked(false); videoRef.current?.play(); }}
                  size="lg" 
                  className="gap-2 bg-gradient-romantic"
                >
                  <Play className="w-5 h-5" />
                  Click to Sync Playback
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Empty state when no media loaded and not receiving */}
        {!videoSrc && !youtubeVideoId && !isReceiving && currentMediaType !== 'stream' && (
          <div className="w-full aspect-video flex items-center justify-center bg-black/90 rounded-xl">
            <div className="text-center text-muted-foreground space-y-2">
              <Play className="w-12 h-12 mx-auto opacity-30" />
              <p className="text-sm">Paste a URL or upload a file to start watching</p>
            </div>
          </div>
        )}

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-30">
            <div className="text-center text-white space-y-2">
              <Loader2 className="w-10 h-10 animate-spin mx-auto" />
              <p>Loading video...</p>
            </div>
          </div>
        )}

        {/* Playback Controls Bar */}
        <AnimatePresence>
          {showControls && (videoSrc || youtubeVideoId || (isReceiving && remoteStream)) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pt-8 pb-3 z-20"
              onMouseEnter={() => setShowControls(true)}
            >
              {/* Progress Bar */}
              <div className="mb-3">
                <Slider
                  value={[progressPercent]}
                  onValueChange={handleSeek}
                  max={100}
                  step={0.1}
                  className="cursor-pointer [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:bg-primary"
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                {/* Left Controls */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => skipTime(-10)}
                    className="h-8 w-8 text-white hover:bg-white/20"
                    title="Rewind 10s"
                  >
                    <SkipBack className="w-4 h-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={togglePlayPause}
                    className="h-9 w-9 text-white hover:bg-white/20"
                    title={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => skipTime(10)}
                    className="h-8 w-8 text-white hover:bg-white/20"
                    title="Forward 10s"
                  >
                    <SkipForward className="w-4 h-4" />
                  </Button>

                  <span className="text-xs text-white/80 ml-2 tabular-nums select-none">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                {/* Right Controls */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleMute}
                    className="h-8 w-8 text-white hover:bg-white/20"
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </Button>

                  <div className="w-20 hidden sm:block">
                    <Slider
                      value={[isMuted ? 0 : volume]}
                      onValueChange={handleVolumeChange}
                      max={100}
                      step={1}
                      className="[&_[role=slider]]:h-2.5 [&_[role=slider]]:w-2.5 [&_[role=slider]]:bg-white"
                    />
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleFullscreen}
                    className="h-8 w-8 text-white hover:bg-white/20"
                    title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                  >
                    {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
