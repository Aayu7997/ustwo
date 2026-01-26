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
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  SkipBack, 
  SkipForward,
  Upload,
  Link as LinkIcon,
  Youtube,
  Radio,
  Loader2,
  Settings,
  RefreshCw,
  Users,
  Wifi,
  WifiOff,
  MonitorPlay,
  Heart
} from 'lucide-react';
import Hls from 'hls.js';
import { RobustYouTubePlayer } from '@/components/RobustYouTubePlayer';
import { VimeoPlayer } from '@/components/VimeoPlayer';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { useMediaSync } from '@/hooks/useMediaSync';
import { useMediaStreaming } from '@/hooks/useMediaStreaming';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface PremiumVideoPlayerProps {
  roomId: string;
  roomCode?: string;
  onPlaybackStateChange?: (state: any) => void;
}

export const PremiumVideoPlayer: React.FC<PremiumVideoPlayerProps> = ({ 
  roomId, 
  roomCode,
  onPlaybackStateChange 
}) => {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const playerReadyRef = useRef<boolean>(false);
  const pendingSyncRef = useRef<{ time: number; isPlaying: boolean } | null>(null);
  const syncIntervalRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
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
  const [currentMediaType, setCurrentMediaType] = useState<'local' | 'url' | 'youtube' | 'vimeo' | 'hls' | 'stream'>('local');
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [urlInput, setUrlInput] = useState('');

  // Partner controls refs
  const ytControlsRef = useRef<any>(null);
  const vimeoControlsRef = useRef<any>(null);

  // P2P Live Streaming
  const {
    isStreaming,
    isReceiving,
    connectionState: streamConnectionState,
    remoteStream,
    remoteVideoRef,
    startStreaming,
    stopStreaming,
    syncPlaybackState: syncStreamPlayback
  } = useMediaStreaming({ roomId, roomCode, enabled: true });

  // Media sync hook
  const {
    syncMediaSource,
    sendPlaybackState,
    broadcastSync,
    fetchInitialState,
    isStorageUrl,
    getSignedUrl
  } = useMediaSync({
    roomId,
    onSyncReceived: async (state) => {
      console.log('[PremiumPlayer] Sync received:', state);
      
      if (state.mediaUrl && state.mediaType) {
        await handleMediaSourceChange(state.mediaUrl, state.mediaType);
        return;
      }

      if (playerReadyRef.current) {
        await applySyncState(state.time, state.isPlaying);
      } else {
        pendingSyncRef.current = { time: state.time, isPlaying: state.isPlaying };
      }
    }
  });

  // Realtime sync
  const { sendPlaybackUpdate, sendSyncEvent } = useRealtimeSync({
    roomId,
    onPlaybackUpdate: (state) => {},
    onMediaSync: async (syncTime: number, syncPlaying: boolean) => {
      if (playerReadyRef.current) {
        await applySyncState(syncTime, syncPlaying);
      } else {
        pendingSyncRef.current = { time: syncTime, isPlaying: syncPlaying };
      }
    }
  });

  // Apply sync state
  const applySyncState = useCallback(async (time: number, playing: boolean) => {
    const SYNC_THRESHOLD = 0.7;

    if (currentMediaType === 'youtube' && ytControlsRef.current) {
      const cur = ytControlsRef.current.getCurrentTime?.() ?? 0;
      if (Math.abs(cur - time) > SYNC_THRESHOLD) {
        ytControlsRef.current.seekTo(time);
      }
      if (playing) ytControlsRef.current.play();
      else ytControlsRef.current.pause();
    } else if (currentMediaType === 'vimeo' && vimeoControlsRef.current) {
      const cur = await vimeoControlsRef.current.getCurrentTime?.() ?? 0;
      if (Math.abs(cur - time) > SYNC_THRESHOLD) {
        vimeoControlsRef.current.seekTo(time);
      }
      const isPaused = await vimeoControlsRef.current.getPaused?.() ?? true;
      if (playing && isPaused) vimeoControlsRef.current.play();
      else if (!playing && !isPaused) vimeoControlsRef.current.pause();
    } else if (videoRef.current) {
      if (Math.abs(videoRef.current.currentTime - time) > SYNC_THRESHOLD) {
        videoRef.current.currentTime = time;
      }
      if (playing && videoRef.current.paused) {
        try {
          await videoRef.current.play();
        } catch (e) {
          setAutoplayBlocked(true);
        }
      }
      if (!playing && !videoRef.current.paused) {
        videoRef.current.pause();
      }
    }
    setIsPlaying(playing);
    setCurrentTime(time);
  }, [currentMediaType]);

  // Handle media source change
  const handleMediaSourceChange = useCallback(async (url: string, type: string) => {
    console.log('[PremiumPlayer] Media source change:', type, url);
    
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
      setCurrentMediaType(type as any);
      setYoutubeVideoId(null);
    }
    
    setIsLoading(false);
  }, []);

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
      // Check for YouTube
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

      // Check for Vimeo
      const vimeoMatch = urlInput.match(/vimeo\.com\/(?:video\/)?(\d+)/);
      if (vimeoMatch) {
        setVideoSrc(vimeoMatch[1]);
        setCurrentMediaType('vimeo');
        await syncMediaSource(vimeoMatch[1], 'vimeo');
        toast({ title: 'Vimeo Video Loaded! 📺' });
        setUrlInput('');
        return;
      }

      // HLS stream
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

      // Direct video URL
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

  // Start streaming
  const handleStartStreaming = async () => {
    if (!videoRef.current || !currentFile) {
      toast({ title: "No video loaded", description: "Load a local video first", variant: "destructive" });
      return;
    }
    
    const success = await startStreaming(videoRef.current);
    if (success) {
      setCurrentMediaType('stream');
      toast({ title: "Streaming Started! 📡", description: "Your partner can now see your video" });
    }
  };

  // Playback controls
  const togglePlayPause = () => {
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
  };

  const handleSeek = (value: number[]) => {
    const time = (value[0] / 100) * (duration || 0);
    if (currentMediaType === 'youtube' && ytControlsRef.current) {
      ytControlsRef.current.seekTo(time);
    } else if (currentMediaType === 'vimeo' && vimeoControlsRef.current) {
      vimeoControlsRef.current.seekTo(time);
    } else if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
    setCurrentTime(time);
    sendPlaybackState(time, isPlaying);
    broadcastSync('seek', time, isPlaying);
  };

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
      if (isMuted) {
        videoRef.current.volume = volume / 100;
        setIsMuted(false);
      } else {
        videoRef.current.volume = 0;
        setIsMuted(true);
      }
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
    if (currentMediaType === 'youtube' && ytControlsRef.current) {
      ytControlsRef.current.seekTo(ytControlsRef.current.getCurrentTime() + seconds);
    } else if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
    }
  };

  // Video event handlers
  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    setAutoplayBlocked(false);
    
    if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);

    const sendNow = async () => {
      let time = 0;
      if (currentMediaType === 'youtube' && ytControlsRef.current) {
        time = ytControlsRef.current.getCurrentTime?.() ?? 0;
      } else if (videoRef.current) {
        time = videoRef.current.currentTime;
      }
      setCurrentTime(time);
      await sendPlaybackState(time, true);
      await broadcastSync('play', time, true);
    };
    
    void sendNow();
    syncIntervalRef.current = window.setInterval(() => void sendNow(), 500);
  }, [currentMediaType, sendPlaybackState, broadcastSync]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
    
    const getTime = async () => {
      if (currentMediaType === 'youtube' && ytControlsRef.current) {
        return ytControlsRef.current.getCurrentTime?.() ?? 0;
      } else if (videoRef.current) {
        return videoRef.current.currentTime;
      }
      return 0;
    };
    
    getTime().then(time => {
      sendPlaybackState(time, false);
      broadcastSync('pause', time, false);
    });
  }, [currentMediaType, sendPlaybackState, broadcastSync]);

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
        const { time, isPlaying: playing } = pendingSyncRef.current;
        applySyncState(time, playing);
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

  // Initial sync
  useEffect(() => {
    const applyInitial = async () => {
      const state = await fetchInitialState();
      if (!state) return;
      
      if (state.mediaUrl && state.mediaType) {
        await handleMediaSourceChange(state.mediaUrl, state.mediaType);
      }
      
      if (state.time || state.isPlaying) {
        pendingSyncRef.current = { time: state.time, isPlaying: state.isPlaying };
      }
    };

    void applyInitial();
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
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, []);

  // Report playback state
  useEffect(() => {
    onPlaybackStateChange?.({
      is_playing: isPlaying,
      current_time_seconds: currentTime,
      duration_seconds: duration
    });
  }, [isPlaying, currentTime, duration, onPlaybackStateChange]);

  // Auto-hide controls
  useEffect(() => {
    let timeout: number;
    
    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = window.setTimeout(() => {
        if (isPlaying) setShowControls(false);
      }, 3000);
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
    }

    return () => {
      clearTimeout(timeout);
      container?.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isPlaying]);

  const progressPercent = duration ? (currentTime / duration) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full space-y-6"
    >
      {/* Source Selection */}
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
              {!isStreaming ? (
                <Button 
                  onClick={handleStartStreaming}
                  disabled={!currentFile || !videoRef.current}
                  className="flex-1 bg-gradient-romantic"
                >
                  <Radio className="w-4 h-4 mr-2" />
                  Stream to Partner
                </Button>
              ) : (
                <Button 
                  onClick={stopStreaming}
                  variant="destructive"
                  className="flex-1"
                >
                  <WifiOff className="w-4 h-4 mr-2" />
                  Stop Streaming
                </Button>
              )}
            </div>
            {isStreaming && (
              <Badge variant="default" className="bg-green-500">
                <Radio className="w-3 h-3 mr-1 animate-pulse" />
                Live Streaming to Partner
              </Badge>
            )}
            {isReceiving && (
              <Badge variant="default" className="bg-primary">
                <Wifi className="w-3 h-3 mr-1" />
                Receiving Partner's Stream
              </Badge>
            )}
          </TabsContent>
        </Tabs>
      </Card>

      {/* Video Player */}
      <div 
        ref={containerRef}
        className="relative bg-black rounded-xl overflow-hidden shadow-2xl group"
        onMouseEnter={() => setShowControls(true)}
      >
        {/* Receiving Partner's Stream */}
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

        {/* YouTube Player */}
        {!isReceiving && currentMediaType === 'youtube' && youtubeVideoId && (
          <RobustYouTubePlayer 
            videoId={youtubeVideoId}
            onPlaybackUpdate={(time, playing) => {
              setCurrentTime(time);
              setIsPlaying(playing);
              sendPlaybackState(time, playing);
              broadcastSync(playing ? 'play' : 'pause', time, playing);
            }}
            onDurationChange={(d) => setDuration(d)}
            onReady={() => {
              playerReadyRef.current = true;
              setIsLoading(false);
              if (pendingSyncRef.current) {
                const { time, isPlaying: playing } = pendingSyncRef.current;
                if (ytControlsRef.current) {
                  ytControlsRef.current.seekTo(time);
                  if (playing) ytControlsRef.current.play();
                  else ytControlsRef.current.pause();
                }
                pendingSyncRef.current = null;
              }
            }}
            onReadyControls={(api) => { ytControlsRef.current = api; }}
            onError={(err) => toast({ title: 'YouTube Error', description: err, variant: 'destructive' })}
          />
        )}

        {/* Vimeo Player */}
        {!isReceiving && currentMediaType === 'vimeo' && (
          <VimeoPlayer 
            videoId={videoSrc}
            onPlaybackUpdate={(time, playing) => {
              setCurrentTime(time);
              setIsPlaying(playing);
              sendPlaybackState(time, playing);
              broadcastSync(playing ? 'play' : 'pause', time, playing);
            }}
            onDurationChange={(d) => setDuration(d)}
            onReadyControls={(api) => { 
              vimeoControlsRef.current = api;
              playerReadyRef.current = true;
              setIsLoading(false);
            }}
          />
        )}

        {/* Native Video Player */}
        {!isReceiving && currentMediaType !== 'youtube' && currentMediaType !== 'vimeo' && (
          <div className="relative w-full aspect-video">
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

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-30">
            <div className="text-center text-white space-y-2">
              <Loader2 className="w-10 h-10 animate-spin mx-auto" />
              <p>Loading video...</p>
            </div>
          </div>
        )}

        {/* Controls Overlay */}
        <AnimatePresence>
          {(showControls || !isPlaying) && currentMediaType !== 'youtube' && currentMediaType !== 'vimeo' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/30"
            >
              {/* Top Bar */}
              <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-primary/20 text-primary">
                    <Users className="w-3 h-3 mr-1" />
                    Synced
                  </Badge>
                </div>
                {isStreaming && (
                  <Badge className="bg-red-500 animate-pulse">
                    <Radio className="w-3 h-3 mr-1" />
                    LIVE
                  </Badge>
                )}
              </div>

              {/* Center Play Button */}
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={togglePlayPause}
                  className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors"
                >
                  {isPlaying ? (
                    <Pause className="w-10 h-10 text-white" />
                  ) : (
                    <Play className="w-10 h-10 text-white ml-1" />
                  )}
                </motion.button>
              </div>

              {/* Bottom Controls */}
              <div className="absolute bottom-0 left-0 right-0 p-4 space-y-3">
                {/* Progress Bar */}
                <div className="group/progress">
                  <Slider
                    value={[progressPercent]}
                    onValueChange={handleSeek}
                    max={100}
                    step={0.1}
                    className="w-full cursor-pointer"
                  />
                </div>

                {/* Control Buttons */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => skipTime(-10)}
                      className="text-white hover:bg-white/20 h-10 w-10"
                    >
                      <SkipBack className="w-5 h-5" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={togglePlayPause}
                      className="text-white hover:bg-white/20 h-12 w-12"
                    >
                      {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => skipTime(10)}
                      className="text-white hover:bg-white/20 h-10 w-10"
                    >
                      <SkipForward className="w-5 h-5" />
                    </Button>

                    <div className="flex items-center gap-2 ml-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleMute}
                        className="text-white hover:bg-white/20 h-10 w-10"
                      >
                        {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                      </Button>
                      <div className="w-24 hidden md:block">
                        <Slider
                          value={[isMuted ? 0 : volume]}
                          onValueChange={handleVolumeChange}
                          max={100}
                          step={1}
                        />
                      </div>
                    </div>

                    <span className="text-white text-sm ml-4">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={toggleFullscreen}
                      className="text-white hover:bg-white/20 h-10 w-10"
                    >
                      {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
