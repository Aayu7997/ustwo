import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RobustYouTubePlayer } from '@/components/RobustYouTubePlayer';
import { VimeoPlayer } from '@/components/VimeoPlayer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  Settings,
  Wifi,
  FileText,
  Loader2,
  Radio,
  MonitorPlay
} from 'lucide-react';
import Hls from 'hls.js';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { useSubtitleSync } from '@/hooks/useSubtitleSync';
import { SubtitleUploader } from './SubtitleUploader';
import { useWebTorrent } from '@/hooks/useWebTorrent';
import { useVideoQuality } from '@/hooks/useVideoQuality';
import { VIDEO_QUALITY_PRESETS, VideoQuality } from '@/utils/videoQuality';
import { useMediaSync } from '@/hooks/useMediaSync';
import { useMediaStreaming } from '@/hooks/useMediaStreaming';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface EnhancedVideoPlayerProps {
  roomId: string;
  roomCode?: string;
  onPlaybackStateChange?: (state: any) => void;
}

export const EnhancedVideoPlayer: React.FC<EnhancedVideoPlayerProps> = ({ 
  roomId, 
  roomCode,
  onPlaybackStateChange 
}) => {
  const { user } = useAuth();
  const { quality, setQuality } = useVideoQuality();
  const {
    seedFile, 
    isSeeding, 
    downloadProgress, 
    torrentData, 
    createVideoElement 
  } = useWebTorrent(roomId, roomCode);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const syncIntervalRef = useRef<number | null>(null);
  const playerReadyRef = useRef<boolean>(false);
  const pendingSyncRef = useRef<{ time: number; isPlaying: boolean } | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  // Media source states
  const [videoSrc, setVideoSrc] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null);
  const [vimeoUrl, setVimeoUrl] = useState('');
  const [directUrl, setDirectUrl] = useState('');
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [currentMediaType, setCurrentMediaType] = useState<'local' | 'url' | 'youtube' | 'vimeo' | 'hls' | 'torrent' | 'storage' | 'stream'>('local');
  
  // Settings
  const [enableP2P, setEnableP2P] = useState(true);
  const [enableSync, setEnableSync] = useState(true);
  const [enableLiveStream, setEnableLiveStream] = useState(true);

  // YouTube/Vimeo controls bridge
  const ytControlsRef = useRef<{ play: () => void; pause: () => void; seekTo: (s: number) => void; getCurrentTime: () => number; getPlayerState: () => any } | null>(null);
  const vimeoControlsRef = useRef<{ play: () => void; pause: () => void; seekTo: (s: number) => void; getCurrentTime: () => Promise<number>; getPaused: () => Promise<boolean> } | null>(null);

  // P2P Live Streaming hook
  const {
    isStreaming,
    isReceiving,
    connectionState: streamConnectionState,
    remoteStream,
    remoteVideoRef,
    startStreaming,
    stopStreaming,
    syncPlaybackState: syncStreamPlayback
  } = useMediaStreaming({ roomId, roomCode, enabled: enableLiveStream });

  // Media sync hook for storage-based file sharing
  const {
    uploadMediaFile,
    getSignedUrl,
    isStorageUrl,
    syncMediaSource,
    sendPlaybackState,
    broadcastSync,
    fetchInitialState
  } = useMediaSync({
    roomId,
    onSyncReceived: async (state) => {
      console.log('[EnhancedPlayer] Sync received:', state);
      
      // Handle media source change
      if (state.mediaUrl && state.mediaType) {
        await handleMediaSourceChange(state.mediaUrl, state.mediaType);
        return;
      }

      // Handle playback state sync
      if (playerReadyRef.current) {
        await applySyncState(state.time, state.isPlaying);
      } else {
        pendingSyncRef.current = { time: state.time, isPlaying: state.isPlaying };
      }
    }
  });

  // Apply sync state to current player
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
          console.log('[EnhancedPlayer] Autoplay blocked, showing overlay');
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

  // Handle media source change from partner
  const handleMediaSourceChange = useCallback(async (url: string, type: string) => {
    console.log('[EnhancedPlayer] Media source change:', type, url);
    
    setIsLoading(true);
    playerReadyRef.current = false;

    if (type === 'youtube') {
      setYoutubeVideoId(url);
      setCurrentMediaType('youtube');
      setVideoSrc('');
      toast({ title: 'Partner loaded YouTube video', description: 'Syncing playback...' });
    } else if (type === 'vimeo') {
      setVideoSrc(url);
      setCurrentMediaType('vimeo');
      setYoutubeVideoId(null);
      toast({ title: 'Partner loaded Vimeo video', description: 'Syncing playback...' });
    } else if (type === 'hls') {
      if (Hls.isSupported()) {
        if (hlsRef.current) { try { hlsRef.current.destroy(); } catch {} }
        hlsRef.current = new Hls();
        hlsRef.current.loadSource(url);
        if (videoRef.current) hlsRef.current.attachMedia(videoRef.current);
      }
      setCurrentMediaType('hls');
      setVideoSrc('');
      setYoutubeVideoId(null);
      toast({ title: 'Partner loaded HLS stream', description: 'Syncing playback...' });
    } else if (type === 'storage' || type === 'url' || type === 'local') {
      setVideoSrc(url);
      setCurrentMediaType(type === 'storage' ? 'storage' : 'url');
      setYoutubeVideoId(null);
      toast({ title: 'Partner loaded video', description: 'Syncing playback...' });
    }
    
    setIsLoading(false);
  }, []);

  // Realtime sync for playback control events
  const { sendPlaybackUpdate, sendSyncEvent } = useRealtimeSync({
    roomId,
    onPlaybackUpdate: (state) => { 
      console.log('[EnhancedPlayer] Realtime playback update:', state); 
    },
    onMediaSync: async (syncTime: number, syncPlaying: boolean) => {
      if (playerReadyRef.current) {
        await applySyncState(syncTime, syncPlaying);
      } else {
        pendingSyncRef.current = { time: syncTime, isPlaying: syncPlaying };
      }
    }
  });

  // Subtitle sync
  const { currentSubtitle, loadSubtitles, clearSubtitles, hasSubtitles } = useSubtitleSync({
    roomId,
    currentTime
  });

  // Update playback state callback
  useEffect(() => {
    onPlaybackStateChange?.({
      is_playing: isPlaying,
      current_time_seconds: currentTime,
      duration_seconds: duration
    });
  }, [isPlaying, currentTime, duration, onPlaybackStateChange]);

  // Mark player as ready when video metadata loads
  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      playerReadyRef.current = true;
      setIsLoading(false);
      
      // Apply pending sync
      if (pendingSyncRef.current) {
        const { time, isPlaying: playing } = pendingSyncRef.current;
        console.log('[EnhancedPlayer] Applying pending sync:', pendingSyncRef.current);
        applySyncState(time, playing);
        pendingSyncRef.current = null;
      }
    }
  }, [applySyncState]);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, []);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    setAutoplayBlocked(false);
    
    if (enableSync) {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }

      const sendNow = async () => {
        try {
          let time = 0;
          if (currentMediaType === 'youtube' && ytControlsRef.current) {
            time = ytControlsRef.current.getCurrentTime?.() ?? 0;
          } else if (currentMediaType === 'vimeo' && vimeoControlsRef.current) {
            time = (await vimeoControlsRef.current.getCurrentTime?.()) ?? 0;
          } else if (videoRef.current) {
            time = videoRef.current.currentTime;
          }
          setCurrentTime(time);
          await sendPlaybackState(time, true);
          await broadcastSync('play', time, true);
        } catch {}
      };
      
      void sendNow();
      syncIntervalRef.current = window.setInterval(() => {
        void sendNow();
      }, 500);
    }
  }, [currentMediaType, enableSync, sendPlaybackState, broadcastSync]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
    
    if (enableSync) {
      const getTime = async () => {
        if (currentMediaType === 'youtube' && ytControlsRef.current) {
          return ytControlsRef.current.getCurrentTime?.() ?? 0;
        } else if (currentMediaType === 'vimeo' && vimeoControlsRef.current) {
          return (await vimeoControlsRef.current.getCurrentTime?.()) ?? 0;
        } else if (videoRef.current) {
          return videoRef.current.currentTime;
        }
        return 0;
      };
      
      getTime().then(time => {
        sendPlaybackState(time, false);
        broadcastSync('pause', time, false);
      });
    }
  }, [currentMediaType, enableSync, sendPlaybackState, broadcastSync]);

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
    if (enableSync) {
      sendPlaybackState(time, isPlaying);
      broadcastSync('seek', time, isPlaying);
    }
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

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      videoRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Handle autoplay unlock
  const handleUnlockAutoplay = async () => {
    setAutoplayBlocked(false);
    if (videoRef.current) {
      try {
        await videoRef.current.play();
        setIsPlaying(true);
      } catch {}
    }
  };

  // File handling - Local playback with P2P live streaming to partner
  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0 || !user) return;

    const file = files[0];
    if (!file.type.startsWith('video/')) {
      toast({
        title: "Invalid File Type",
        description: "Please select a video file",
        variant: "destructive"
      });
      return;
    }

    setCurrentFile(file);
    setIsLoading(true);
    playerReadyRef.current = false;

    // Create local blob URL for playback
    const blobUrl = URL.createObjectURL(file);
    setVideoSrc(blobUrl);
    setCurrentMediaType('local');
    setYoutubeVideoId(null);
    setIsLoading(false);
    
    toast({
      title: "Video Loaded! 🎬",
      description: enableLiveStream 
        ? `${file.name} - Click "Start Streaming" to share with partner`
        : `${file.name} - Playing locally`
    });
  };

  // Start streaming the local video to partner
  const handleStartStreaming = async () => {
    if (!videoRef.current || !currentFile) {
      toast({
        title: "No video loaded",
        description: "Load a local video first",
        variant: "destructive"
      });
      return;
    }
    
    const success = await startStreaming(videoRef.current);
    if (success) {
      setCurrentMediaType('stream');
    }
  };

  // Stop streaming
  const handleStopStreaming = async () => {
    await stopStreaming();
    if (currentFile) {
      setCurrentMediaType('local');
    }
  };



  const extractYouTubeId = (url: string): string | null => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const handleDirectUrlLoad = async () => {
    if (!directUrl.trim()) {
      toast({
        title: "No URL provided",
        description: "Please enter a video URL",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    playerReadyRef.current = false;
    
    try {
      const urlToLoad = directUrl.trim();
      
      // Validate URL format
      let validUrl: URL;
      try {
        validUrl = new URL(urlToLoad.startsWith('http') ? urlToLoad : `https://${urlToLoad}`);
      } catch {
        throw new Error('Invalid URL format');
      }
      
      // Check for Vimeo
      const vimeoMatch = urlToLoad.match(/vimeo\.com\/(?:video\/)?(\d+)/);
      if (vimeoMatch) {
        setVideoSrc(vimeoMatch[1]);
        setCurrentMediaType('vimeo');
        await syncMediaSource(vimeoMatch[1], 'vimeo');
        toast({ title: "Vimeo Video Loaded! 📺" });
        return;
      }

      // Check for YouTube
      const ytId = extractYouTubeId(urlToLoad);
      if (ytId) {
        setYoutubeVideoId(ytId);
        setCurrentMediaType('youtube');
        setVideoSrc('');
        await syncMediaSource(ytId, 'youtube');
        toast({ title: 'YouTube Video Loaded! 📺' });
        return;
      }

      // HLS stream
      if (urlToLoad.includes('.m3u8')) {
        if (Hls.isSupported()) {
          if (hlsRef.current) { try { hlsRef.current.destroy(); } catch {} }
          hlsRef.current = new Hls({
            maxBufferLength: 30,
            maxMaxBufferLength: 600,
            enableWorker: true,
            lowLatencyMode: true,
          });
          hlsRef.current.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal) {
              toast({ title: 'Stream Error', description: 'Failed to load HLS stream', variant: 'destructive' });
            }
          });
          hlsRef.current.loadSource(urlToLoad);
          if (videoRef.current) hlsRef.current.attachMedia(videoRef.current);
          setCurrentMediaType('hls');
          setVideoSrc('');
          await syncMediaSource(urlToLoad, 'hls');
          toast({ title: 'HLS Stream Loaded! 📺' });
        } else {
          throw new Error('HLS not supported in your browser');
        }
        return;
      }

      // Direct video URL
      if (urlToLoad.match(/\.(mp4|webm|ogg|mov)$/i) || validUrl.protocol.startsWith('http')) {
        if (hlsRef.current) { try { hlsRef.current.destroy(); } catch {} hlsRef.current = null; }
        setYoutubeVideoId(null);
        setVideoSrc(validUrl.href);
        setCurrentMediaType('url');
        await syncMediaSource(validUrl.href, 'url');
        toast({ title: 'Video URL Loaded! 🎬' });
      } else {
        throw new Error('Unsupported format. Use MP4, WebM, HLS, YouTube or Vimeo links.');
      }
    } catch (error) {
      console.error('Error loading video URL:', error);
      toast({
        title: "Loading Error",
        description: error instanceof Error ? error.message : "Failed to load video",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleYouTubeLoad = async () => {
    if (!youtubeUrl.trim()) {
      toast({ title: "No YouTube URL provided", variant: "destructive" });
      return;
    }

    const videoId = extractYouTubeId(youtubeUrl);
    if (videoId) {
      setYoutubeVideoId(videoId);
      setCurrentMediaType('youtube');
      setVideoSrc('');
      playerReadyRef.current = false;
      await syncMediaSource(videoId, 'youtube');
      toast({ title: 'YouTube Video Loaded! 📺' });
    } else {
      toast({ title: 'Invalid YouTube URL', variant: 'destructive' });
    }
  };

  // Realtime media source sync from room
  useEffect(() => {
    const channel = supabase
      .channel(`room_media_${roomId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'rooms',
        filter: `id=eq.${roomId}`
      }, async (payload) => {
        const newRoom = payload.new as any;
        if (!newRoom.current_media_url || !newRoom.current_media_type) return;
        
        // Check if same media
        const isSameMedia = 
          (currentMediaType === newRoom.current_media_type) &&
          ((currentMediaType === 'youtube' && youtubeVideoId === newRoom.current_media_url) ||
           (currentMediaType === 'vimeo' && videoSrc === newRoom.current_media_url) ||
           ((currentMediaType === 'url' || currentMediaType === 'hls') && videoSrc === newRoom.current_media_url));
        
        if (isSameMedia) return;
        
        console.log('[EnhancedPlayer] Partner media update:', newRoom.current_media_type, newRoom.current_media_url);
        
        let mediaUrl = newRoom.current_media_url;
        
        // Resolve storage URLs
        if (isStorageUrl(mediaUrl)) {
          const signedUrl = await getSignedUrl(mediaUrl);
          if (signedUrl) {
            mediaUrl = signedUrl;
          } else {
            toast({ title: 'Failed to load shared video', variant: 'destructive' });
            return;
          }
        }
        
        await handleMediaSourceChange(mediaUrl, newRoom.current_media_type);
      })
      .subscribe();
    
    return () => { supabase.removeChannel(channel); };
  }, [roomId, currentMediaType, youtubeVideoId, videoSrc, isStorageUrl, getSignedUrl, handleMediaSourceChange]);

  // Initial sync on mount
  useEffect(() => {
    const applyInitial = async () => {
      const state = await fetchInitialState();
      if (!state) return;
      
      if (state.mediaUrl && state.mediaType) {
        await handleMediaSourceChange(state.mediaUrl, state.mediaType);
      }
      
      // Store pending sync for when player becomes ready
      if (state.time || state.isPlaying) {
        pendingSyncRef.current = { time: state.time, isPlaying: state.isPlaying };
      }
    };

    if (enableSync) {
      void applyInitial();
    }
  }, [roomId, enableSync, fetchInitialState, handleMediaSourceChange]);

  // Setup video element events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [handleTimeUpdate, handleLoadedMetadata, handlePlay, handlePause]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        try { hlsRef.current.destroy(); } catch {}
        hlsRef.current = null;
      }
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, []);

  // Update video source
  useEffect(() => {
    if (videoRef.current && videoSrc && currentMediaType !== 'torrent') {
      videoRef.current.src = videoSrc;
    }
  }, [videoSrc, currentMediaType]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-4xl mx-auto space-y-4"
    >
      <Card className="overflow-hidden">
        <div className="relative bg-black">
          {/* YouTube Player with RobustYouTubePlayer */}
          {currentMediaType === 'youtube' && youtubeVideoId ? (
            <div className="w-full">
              <RobustYouTubePlayer 
                videoId={youtubeVideoId}
                onPlaybackUpdate={(time, playing) => {
                  setCurrentTime(time);
                  setIsPlaying(playing);
                  if (enableSync && playing) {
                    sendPlaybackState(time, playing);
                  }
                }}
                onDurationChange={(d) => setDuration(d)}
                onReady={() => {
                  playerReadyRef.current = true;
                  setIsLoading(false);
                  
                  if (pendingSyncRef.current) {
                    const { time, isPlaying: playing } = pendingSyncRef.current;
                    if (ytControlsRef.current) {
                      if (Math.abs(ytControlsRef.current.getCurrentTime() - time) > 0.7) {
                        ytControlsRef.current.seekTo(time);
                      }
                      if (playing) ytControlsRef.current.play();
                    }
                    pendingSyncRef.current = null;
                  }
                }}
                onReadyControls={(api) => { 
                  ytControlsRef.current = api; 
                }}
                onError={(err) => {
                  toast({ title: 'YouTube Error', description: err, variant: 'destructive' });
                }}
              />
            </div>
          ) : currentMediaType === 'vimeo' ? (
            <div className="w-full">
              <VimeoPlayer 
                videoId={videoSrc}
                onPlaybackUpdate={(time, playing) => {
                  setCurrentTime(time);
                  setIsPlaying(playing);
                  if (enableSync && playing) {
                    sendPlaybackState(time, playing);
                  }
                }}
                onDurationChange={(d) => setDuration(d)}
                onReadyControls={async (api) => { 
                  vimeoControlsRef.current = api;
                  playerReadyRef.current = true;
                  setIsLoading(false);
                  
                  if (pendingSyncRef.current) {
                    const { time, isPlaying: playing } = pendingSyncRef.current;
                    api.seekTo(time);
                    if (playing) api.play();
                    else api.pause();
                    pendingSyncRef.current = null;
                  }
                }}
              />
            </div>
          ) : (
            <div className="relative w-full">
              <video
                ref={videoRef}
                src={videoSrc}
                className="w-full aspect-video object-contain"
                controls={false}
                playsInline
                crossOrigin="anonymous"
                preload="metadata"
                onError={(e) => {
                  console.error('Video playback error:', e);
                  if (hlsRef.current) { try { hlsRef.current.destroy(); } catch {} hlsRef.current = null; }
                  if (!videoSrc) return;
                  
                  // Try to refresh signed URL for storage videos
                  if (currentMediaType === 'storage') {
                    toast({
                      title: 'Playback Error',
                      description: 'Video URL expired. Refreshing...',
                    });
                    // The partner sync will handle re-fetching
                    return;
                  }
                  
                  const err = (e.currentTarget as HTMLVideoElement)?.error;
                  const messages: Record<number, string> = {
                    1: 'Video loading aborted',
                    2: 'Network error while fetching video',
                    3: 'Video decoding failed',
                    4: 'Video source not found'
                  };
                  toast({
                    title: 'Playback Error',
                    description: messages[err?.code ?? 0] || 'Failed to load video',
                    variant: 'destructive'
                  });
                }}
              />
              
              {/* Autoplay blocked overlay */}
              {autoplayBlocked && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
                  <Button onClick={handleUnlockAutoplay} size="lg" className="gap-2">
                    <Play className="w-5 h-5" />
                    Click to Sync Playback
                  </Button>
                </div>
              )}
              
              {/* Subtitle Overlay */}
              {hasSubtitles && currentSubtitle && (
                <div className="absolute bottom-20 left-0 right-0 flex justify-center px-4 pointer-events-none z-10">
                  <div className="bg-black/90 text-white px-6 py-3 rounded-lg max-w-4xl text-center text-lg font-medium leading-relaxed shadow-lg">
                    {currentSubtitle}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Loading Overlay */}
          {(isLoading || isUploading) && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-30">
              <div className="text-center text-white">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                <p>{isUploading ? 'Uploading video...' : 'Loading video...'}</p>
              </div>
            </div>
          )}

          {/* P2P Download Progress */}
          {downloadProgress > 0 && downloadProgress < 100 && (
            <div className="absolute inset-0 bg-black/75 flex items-center justify-center z-30">
              <div className="text-center text-white space-y-2">
                <Wifi className="w-8 h-8 mx-auto animate-pulse" />
                <p>Downloading via P2P...</p>
                <div className="w-48 bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
                <p className="text-sm">{downloadProgress}%</p>
              </div>
            </div>
          )}

          {/* Controls Overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
            {/* Progress Bar */}
            <div className="mb-4">
              <Slider
                value={[duration ? (currentTime / duration) * 100 : 0]}
                onValueChange={handleSeek}
                max={100}
                step={0.1}
                className="w-full"
              />
            </div>

            {/* Control Buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (currentMediaType === 'youtube' && ytControlsRef.current) {
                      ytControlsRef.current.seekTo(Math.max(0, ytControlsRef.current.getCurrentTime() - 10));
                    } else if (videoRef.current) {
                      videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
                    }
                  }}
                  className="text-white hover:bg-white/20"
                >
                  <SkipBack className="w-4 h-4" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={togglePlayPause}
                  className="text-white hover:bg-white/20"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (currentMediaType === 'youtube' && ytControlsRef.current) {
                      ytControlsRef.current.seekTo(ytControlsRef.current.getCurrentTime() + 10);
                    } else if (videoRef.current) {
                      videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 10);
                    }
                  }}
                  className="text-white hover:bg-white/20"
                >
                  <SkipForward className="w-4 h-4" />
                </Button>

                <div className="flex items-center gap-2 text-white">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleMute}
                    className="text-white hover:bg-white/20"
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </Button>
                  
                  <div className="w-20">
                    <Slider
                      value={[isMuted ? 0 : volume]}
                      onValueChange={handleVolumeChange}
                      max={100}
                      step={1}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-white text-sm">
                  {Math.floor(currentTime / 60)}:{(Math.floor(currentTime % 60)).toString().padStart(2, '0')} / {Math.floor(duration / 60)}:{(Math.floor(duration % 60)).toString().padStart(2, '0')}
                </span>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleFullscreen}
                  className="text-white hover:bg-white/20"
                >
                  {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Media Source Tabs */}
      <Card>
        <div className="p-6">
          <Tabs defaultValue="file" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="file" className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Local File
              </TabsTrigger>
              <TabsTrigger value="url" className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4" />
                Direct URL
              </TabsTrigger>
              <TabsTrigger value="youtube" className="flex items-center gap-2">
                <Youtube className="w-4 h-4" />
                YouTube
              </TabsTrigger>
              <TabsTrigger value="subtitles" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Subtitles
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="file" className="space-y-4">
              <div className="text-center space-y-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => handleFileSelect(e.target.files)}
                  accept="video/*"
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                  disabled={isSeeding || isStreaming}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Choose Video File
                </Button>
                
                {currentFile && (
                  <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm font-medium">{currentFile.name}</p>
                    
                    {!isStreaming && !isReceiving ? (
                      <Button 
                        onClick={handleStartStreaming} 
                        className="w-full gap-2"
                        variant="secondary"
                      >
                        <Radio className="w-4 h-4" />
                        Start Live Streaming to Partner
                      </Button>
                    ) : isStreaming ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-center gap-2 text-green-500">
                          <Radio className="w-4 h-4 animate-pulse" />
                          <span className="text-sm font-medium">Streaming to partner...</span>
                        </div>
                        <Button 
                          onClick={handleStopStreaming} 
                          variant="destructive" 
                          size="sm"
                          className="w-full"
                        >
                          Stop Streaming
                        </Button>
                      </div>
                    ) : null}
                  </div>
                )}
                
                {isReceiving && (
                  <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <div className="flex items-center justify-center gap-2 text-green-500">
                      <MonitorPlay className="w-5 h-5" />
                      <span className="font-medium">Receiving partner's stream</span>
                    </div>
                  </div>
                )}
                
                <p className="text-sm text-muted-foreground">
                  Local files stream directly to your partner via P2P - no upload needed!
                </p>
              </div>
            </TabsContent>

            <TabsContent value="url" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="direct-url">Video URL (Vimeo, MP4, WebM, HLS, YouTube)</Label>
                <Input
                  id="direct-url"
                  type="url"
                  placeholder="https://example.com/video.mp4"
                  value={directUrl}
                  onChange={(e) => setDirectUrl(e.target.value)}
                />
              </div>
              <Button onClick={handleDirectUrlLoad} className="w-full" disabled={isLoading}>
                <LinkIcon className="w-4 h-4 mr-2" />
                {isLoading ? 'Loading...' : 'Load Video'}
              </Button>
            </TabsContent>

            <TabsContent value="youtube" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="youtube-url">YouTube URL</Label>
                <Input
                  id="youtube-url"
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                />
              </div>
              <Button onClick={handleYouTubeLoad} className="w-full">
                <Youtube className="w-4 h-4 mr-2" />
                Load YouTube Video
              </Button>
            </TabsContent>

            <TabsContent value="subtitles" className="space-y-4">
              <SubtitleUploader
                roomId={roomId}
                onSubtitleUploaded={(url, format) => loadSubtitles(url, format)}
              />
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>P2P File Sharing</Label>
                    <p className="text-sm text-muted-foreground">Share files directly between browsers</p>
                  </div>
                  <Switch
                    checked={enableP2P}
                    onCheckedChange={setEnableP2P}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Sync Playback</Label>
                    <p className="text-sm text-muted-foreground">Synchronize play/pause with partner</p>
                  </div>
                  <Switch
                    checked={enableSync}
                    onCheckedChange={setEnableSync}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Playback Speed</Label>
                  <Slider
                    value={[playbackSpeed]}
                    onValueChange={(value) => {
                      const speed = value[0];
                      setPlaybackSpeed(speed);
                      if (videoRef.current) {
                        videoRef.current.playbackRate = speed;
                      }
                    }}
                    min={0.25}
                    max={2}
                    step={0.25}
                    className="w-full"
                  />
                  <p className="text-sm text-muted-foreground">{playbackSpeed}x speed</p>
                </div>

                <div className="space-y-2">
                  <Label>Video Quality</Label>
                  <Select value={quality} onValueChange={(value) => setQuality(value as VideoQuality)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select quality" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(VIDEO_QUALITY_PRESETS).map(([key, preset]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex flex-col items-start">
                            <span className="font-medium">{preset.label}</span>
                            <span className="text-xs text-muted-foreground">{preset.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Current: {VIDEO_QUALITY_PRESETS[quality].label}
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </Card>
    </motion.div>
  );
};
