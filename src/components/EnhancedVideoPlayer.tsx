import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { YouTubePlayer } from '@/components/YouTubePlayer';
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
  Download,
  Wifi
} from 'lucide-react';
import Hls from 'hls.js';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { useWebTorrent } from '@/hooks/useWebTorrent';
import { useVideoQuality } from '@/hooks/useVideoQuality';
import { VIDEO_QUALITY_PRESETS, VideoQuality } from '@/utils/videoQuality';
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
  // Using realtime sync for live partner synchronization
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
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Media source states
  const [videoSrc, setVideoSrc] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null);
  const [vimeoUrl, setVimeoUrl] = useState('');
  const [directUrl, setDirectUrl] = useState('');
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [currentMediaType, setCurrentMediaType] = useState<'local' | 'url' | 'youtube' | 'vimeo' | 'hls' | 'torrent'>('local');
  
  // Settings
  const [enableP2P, setEnableP2P] = useState(true);
  const [enableSync, setEnableSync] = useState(true);

  // YouTube/Vimeo controls bridge
  const ytControlsRef = useRef<{ play: () => void; pause: () => void; seekTo: (s: number) => void; getCurrentTime: () => number; getPlayerState: () => any } | null>(null);
  const vimeoControlsRef = useRef<{ play: () => void; pause: () => void; seekTo: (s: number) => void; getCurrentTime: () => Promise<number>; getPaused: () => Promise<boolean> } | null>(null);
  const syncIntervalRef = useRef<number | null>(null);

  // Realtime sync: listen and act on partner updates
  const { sendPlaybackUpdate, sendSyncEvent } = useRealtimeSync({
    roomId,
    onPlaybackUpdate: (state) => { console.log('Partner sync received:', state); },
    onMediaSync: async (syncTime: number, syncPlaying: boolean) => {
      // Apply to active player
      if (currentMediaType === 'youtube' && ytControlsRef.current) {
        const cur = ytControlsRef.current.getCurrentTime?.() ?? 0;
        if (Math.abs(cur - syncTime) > 0.7) {
          ytControlsRef.current.seekTo(syncTime);
        }
        if (syncPlaying) ytControlsRef.current.play();
        else ytControlsRef.current.pause();
      } else if (currentMediaType === 'vimeo' && vimeoControlsRef.current) {
        const cur = await vimeoControlsRef.current.getCurrentTime?.() ?? 0;
        if (Math.abs(cur - syncTime) > 0.7) {
          vimeoControlsRef.current.seekTo(syncTime);
        }
        const isPaused = await vimeoControlsRef.current.getPaused?.() ?? true;
        if (syncPlaying && isPaused) vimeoControlsRef.current.play();
        else if (!syncPlaying && !isPaused) vimeoControlsRef.current.pause();
      } else if (videoRef.current) {
        if (Math.abs(videoRef.current.currentTime - syncTime) > 0.7) {
          videoRef.current.currentTime = syncTime;
        }
        if (syncPlaying && videoRef.current.paused) {
          void videoRef.current.play();
        }
        if (!syncPlaying && !videoRef.current.paused) {
          videoRef.current.pause();
        }
      }
      setIsPlaying(syncPlaying);
      setCurrentTime(syncTime);
    }
  });

  // Update playback state callback
  useEffect(() => {
    onPlaybackStateChange?.({
      is_playing: isPlaying,
      current_time_seconds: currentTime,
      duration_seconds: duration
    });
  }, [isPlaying, currentTime, duration, onPlaybackStateChange]);

  // Video event handlers
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  }, []);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    if (enableSync) {
      // Clear existing interval
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
      // Send immediate update and start periodic pings
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
          await sendPlaybackUpdate(time, true);
          await sendSyncEvent('play', time, true);
        } catch {}
      };
      void sendNow();
      syncIntervalRef.current = window.setInterval(() => {
        void sendNow();
      }, 500);
    }
  }, [currentMediaType, enableSync, sendPlaybackUpdate, sendSyncEvent]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
    if (enableSync) {
      const time = currentMediaType === 'youtube' && ytControlsRef.current
        ? ytControlsRef.current.getCurrentTime?.() ?? 0
        : videoRef.current?.currentTime ?? 0;
      sendPlaybackUpdate(time, false);
      sendSyncEvent('pause', time, false);
    }
  }, [currentMediaType, enableSync, sendPlaybackUpdate, sendSyncEvent]);

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
    else void videoRef.current.play();
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
      sendPlaybackUpdate(time, isPlaying);
      sendSyncEvent('seek', time, isPlaying);
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

  // File handling
  const handleFileSelect = async (files: FileList | null) => {
    if (files && files.length > 0) {
      const file = files[0];
      
      if (file.type.startsWith('video/')) {
        // Check if we should seed via WebTorrent
        if (enableP2P && roomCode) {
          setCurrentFile(file);
          setCurrentMediaType('torrent');
          
          const magnetURI = await seedFile(file);
          if (magnetURI) {
            toast({
              title: "File Shared via P2P! 🌐",
              description: `${file.name} is being shared with your partner`
            });
          } else {
            // Fallback to local playback
            const url = URL.createObjectURL(file);
            setVideoSrc(url);
            setCurrentMediaType('local');
          }
        } else {
          const url = URL.createObjectURL(file);
          setVideoSrc(url);
          setCurrentMediaType('local');
        }
        
        setCurrentFile(file);
        
        toast({
          title: "Local Video Loaded! 🎬",
          description: `${file.name} is ready to play`
        });
      } else {
        toast({
          title: "Invalid File Type",
          description: "Please select a video file",
          variant: "destructive"
        });
      }
    }
  };

  const syncMediaSource = async (url: string, type: string) => {
    try {
      await supabase
        .from('rooms')
        .update({ 
          current_media_url: url, 
          current_media_type: type 
        })
        .eq('id', roomId);
    } catch (error) {
      console.error('Failed to sync media source:', error);
    }
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
    
    try {
      const urlToLoad = directUrl.trim();
      
      // Check URL format validity
      let validUrl: URL;
      try {
        validUrl = new URL(urlToLoad.startsWith('http') ? urlToLoad : `https://${urlToLoad}`);
      } catch (urlError) {
        throw new Error('Invalid URL format. Please enter a valid URL.');
      }
      
      // Check if it's a Vimeo URL
      const vimeoMatch = urlToLoad.match(/vimeo\.com\/(?:video\/)?(\d+)/);
      if (vimeoMatch) {
        setVideoSrc(vimeoMatch[1]);
        setCurrentMediaType('vimeo');
        await syncMediaSource(vimeoMatch[1], 'vimeo');
        toast({
          title: "Vimeo Video Loaded! 📺",
          description: "Vimeo video is ready to play"
        });
        setIsLoading(false);
        return;
      }

      // YouTube links
      const ytId = extractYouTubeId(urlToLoad);
      if (ytId) {
        setYoutubeVideoId(ytId);
        setCurrentMediaType('youtube');
        setVideoSrc('');
        await syncMediaSource(ytId, 'youtube');
        toast({ title: 'YouTube Video Loaded! 📺', description: 'YouTube video is ready to play' });
      } else if (urlToLoad.includes('.m3u8')) {
        // HLS stream
        if (Hls.isSupported()) {
          if (hlsRef.current) {
            try { hlsRef.current.destroy(); } catch {}
          }
          
          hlsRef.current = new Hls({
            maxBufferLength: 30,
            maxMaxBufferLength: 600,
            enableWorker: true,
            lowLatencyMode: true,
          });
          
          hlsRef.current.on(Hls.Events.ERROR, (event, data) => {
            console.error('HLS Error:', data);
            if (data.fatal) {
              toast({
                title: 'Stream Error',
                description: 'Failed to load HLS stream. Please check the URL.',
                variant: 'destructive'
              });
            }
          });
          
          hlsRef.current.loadSource(urlToLoad);
          if (videoRef.current) {
            hlsRef.current.attachMedia(videoRef.current);
          }
          
          setCurrentMediaType('hls');
          setVideoSrc('');
          await syncMediaSource(urlToLoad, 'hls');
          toast({ title: 'HLS Stream Loaded! 📺', description: 'Live stream is ready to play' });
        } else {
          toast({ title: 'HLS Not Supported', description: "Your browser doesn't support HLS streaming. Try Chrome or Safari.", variant: 'destructive' });
        }
      } else if (urlToLoad.match(/\.(mp4|webm|ogg|mov)$/i)) {
        // Direct video file
        if (hlsRef.current) { try { hlsRef.current.destroy(); } catch {} hlsRef.current = null; }
        setYoutubeVideoId(null);
        setVideoSrc(urlToLoad);
        setCurrentMediaType('url');
        await syncMediaSource(urlToLoad, 'url');
        toast({ title: 'Video URL Loaded! 🎬', description: 'Video is ready to play' });
      } else {
        toast({ title: 'Unsupported Format', description: 'Please provide a direct video URL (.mp4, .webm, .ogg), HLS (.m3u8), YouTube or Vimeo link', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error loading video URL:', error);
      toast({
        title: "Loading Error",
        description: error instanceof Error ? error.message : "Failed to load video. Please check the URL format.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const extractYouTubeId = (url: string): string | null => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const handleYouTubeLoad = async () => {
    if (!youtubeUrl.trim()) {
      toast({
        title: "No YouTube URL provided",
        description: "Please enter a YouTube URL",
        variant: "destructive"
      });
      return;
    }

    const videoId = extractYouTubeId(youtubeUrl);
    if (videoId) {
      console.log('Loading YouTube video:', videoId);
      setYoutubeVideoId(videoId);
      setCurrentMediaType('youtube');
      setVideoSrc(''); // Clear other sources
      await syncMediaSource(videoId, 'youtube');
      
      toast({
        title: 'YouTube Video Loaded! 📺',
        description: 'YouTube video is ready to play'
      });
    } else {
      toast({
        title: 'Invalid YouTube URL',
        description: 'Please enter a valid YouTube video URL',
        variant: 'destructive'
      });
    }
  };

  // Realtime media source sync: listen for partner loading new media
  useEffect(() => {
    const channel = supabase
      .channel(`room_media_${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`
        },
        (payload) => {
          const newRoom = payload.new as any;
          if (!newRoom.current_media_url || !newRoom.current_media_type) return;
          
          // Don't reload if it's our own update
          const isSameMedia = 
            (currentMediaType === newRoom.current_media_type) &&
            ((currentMediaType === 'youtube' && youtubeVideoId === newRoom.current_media_url) ||
             (currentMediaType === 'vimeo' && videoSrc === newRoom.current_media_url) ||
             ((currentMediaType === 'url' || currentMediaType === 'hls') && videoSrc === newRoom.current_media_url));
          
          if (isSameMedia) return;
          
          console.log('Partner loaded new media:', newRoom.current_media_type, newRoom.current_media_url);
          
          // Apply partner's media choice
          if (newRoom.current_media_type === 'youtube') {
            setYoutubeVideoId(newRoom.current_media_url);
            setCurrentMediaType('youtube');
            setVideoSrc('');
            toast({ title: 'Partner loaded YouTube video', description: 'Syncing playback...' });
          } else if (newRoom.current_media_type === 'vimeo') {
            setVideoSrc(newRoom.current_media_url);
            setCurrentMediaType('vimeo');
            setYoutubeVideoId(null);
            toast({ title: 'Partner loaded Vimeo video', description: 'Syncing playback...' });
          } else if (newRoom.current_media_type === 'hls') {
            if (Hls.isSupported()) {
              if (hlsRef.current) { try { hlsRef.current.destroy(); } catch {} }
              hlsRef.current = new Hls();
              hlsRef.current.loadSource(newRoom.current_media_url);
              if (videoRef.current) hlsRef.current.attachMedia(videoRef.current);
            }
            setCurrentMediaType('hls');
            setVideoSrc('');
            setYoutubeVideoId(null);
            toast({ title: 'Partner loaded HLS stream', description: 'Syncing playback...' });
          } else if (newRoom.current_media_type === 'url') {
            setVideoSrc(newRoom.current_media_url);
            setCurrentMediaType('url');
            setYoutubeVideoId(null);
            toast({ title: 'Partner loaded video URL', description: 'Syncing playback...' });
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, currentMediaType, youtubeVideoId, videoSrc]);

  // Initial sync: fetch latest playback_state and media source when joining
  useEffect(() => {
    const applyInitial = async () => {
      try {
        // Fetch current media source
        const { data: roomData } = await supabase
          .from('rooms')
          .select('current_media_url, current_media_type')
          .eq('id', roomId)
          .single();
        
        if (roomData?.current_media_url && roomData?.current_media_type) {
          const mediaUrl = roomData.current_media_url;
          const mediaType = roomData.current_media_type;
          
          if (mediaType === 'youtube' && !youtubeVideoId) {
            setYoutubeVideoId(mediaUrl);
            setCurrentMediaType('youtube');
          } else if (mediaType === 'vimeo' && !videoSrc) {
            setVideoSrc(mediaUrl);
            setCurrentMediaType('vimeo');
          } else if ((mediaType === 'url' || mediaType === 'hls') && !videoSrc) {
            if (mediaType === 'hls' && Hls.isSupported()) {
              if (hlsRef.current) { try { hlsRef.current.destroy(); } catch {} }
              hlsRef.current = new Hls();
              hlsRef.current.loadSource(mediaUrl);
              if (videoRef.current) hlsRef.current.attachMedia(videoRef.current);
            } else {
              setVideoSrc(mediaUrl);
            }
            setCurrentMediaType(mediaType);
          }
        }

        // Fetch playback state
        const { data, error } = await supabase
          .from('playback_state')
          .select('current_time_seconds,is_playing')
          .eq('room_id', roomId)
          .maybeSingle();
        if (error) return;
        if (!data) return;
        const syncTime = Number(data.current_time_seconds) || 0;
        const syncPlaying = !!data.is_playing;

        // Seek & play/pause based on current media
        if (currentMediaType === 'youtube' && ytControlsRef.current) {
          const cur = ytControlsRef.current.getCurrentTime?.() ?? 0;
          if (Math.abs(cur - syncTime) > 0.7) {
            ytControlsRef.current.seekTo(syncTime);
          }
          if (syncPlaying) ytControlsRef.current.play(); else ytControlsRef.current.pause();
        } else if (currentMediaType === 'vimeo' && vimeoControlsRef.current) {
          const cur = (await vimeoControlsRef.current.getCurrentTime?.()) ?? 0;
          if (Math.abs(cur - syncTime) > 0.7) {
            vimeoControlsRef.current.seekTo(syncTime);
          }
          const paused = await vimeoControlsRef.current.getPaused?.();
          if (syncPlaying && paused) vimeoControlsRef.current.play();
          else if (!syncPlaying && !paused) vimeoControlsRef.current.pause();
        } else if (videoRef.current) {
          if (Math.abs(videoRef.current.currentTime - syncTime) > 0.7) {
            videoRef.current.currentTime = syncTime;
          }
          if (syncPlaying && videoRef.current.paused) void videoRef.current.play();
          if (!syncPlaying && !videoRef.current.paused) videoRef.current.pause();
        }
        setIsPlaying(syncPlaying);
        setCurrentTime(syncTime);
      } catch {}
    };

    if (enableSync) {
      void applyInitial();
    }
  }, [roomId, currentMediaType, enableSync]);

  // Setup video element
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

  // Cleanup HLS on unmount
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
          {/* Video or YouTube Element */}
          {currentMediaType === 'youtube' && youtubeVideoId ? (
            <div className="w-full">
              <YouTubePlayer 
                videoId={youtubeVideoId}
                onPlaybackUpdate={(time, playing) => {
                  setCurrentTime(time);
                  setIsPlaying(playing);
                  if (enableSync) {
                    sendPlaybackUpdate(time, playing);
                  }
                }}
                onDurationChange={(d) => setDuration(d)}
                onReadyControls={async (api) => { 
                  ytControlsRef.current = api; 
                  // Apply latest state once controls ready
                  try {
                    const { data } = await supabase
                      .from('playback_state')
                      .select('current_time_seconds,is_playing')
                      .eq('room_id', roomId)
                      .maybeSingle();
                    if (data) {
                      const t = Number(data.current_time_seconds) || 0;
                      if (Math.abs(api.getCurrentTime?.() - t) > 0.7) api.seekTo(t);
                      data.is_playing ? api.play() : api.pause();
                      setCurrentTime(t);
                      setIsPlaying(!!data.is_playing);
                    }
                  } catch {}
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
                  if (enableSync) {
                    sendPlaybackUpdate(time, playing);
                  }
                }}
                onDurationChange={(d) => setDuration(d)}
                 onReadyControls={async (api) => { 
                    vimeoControlsRef.current = api; 
                    try {
                      const { data } = await supabase
                        .from('playback_state')
                        .select('current_time_seconds,is_playing')
                        .eq('room_id', roomId)
                        .maybeSingle();
                      if (data) {
                        const t = Number(data.current_time_seconds) || 0;
                        api.seekTo(t);
                        if (data.is_playing) api.play(); else api.pause();
                        setCurrentTime(t);
                        setIsPlaying(!!data.is_playing);
                      }
                    } catch {}
                  }}
              />
            </div>
          ) : (
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
                const err = (e.currentTarget as HTMLVideoElement)?.error;
                const code = err?.code;
                const messages: Record<number, string> = {
                  1: 'Video loading aborted',
                  2: 'Network error while fetching video',
                  3: 'Video decoding failed or unsupported format',
                  4: 'Video source not found'
                };
                toast({
                  title: 'Playback Error',
                  description: messages[code ?? 0] || 'Failed to load video. Check URL or format.',
                  variant: 'destructive'
                });
              }}
            />
          )}
          
          {/* Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="text-center text-white">
                <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p>Loading video...</p>
              </div>
            </div>
          )}

          {/* P2P Download Progress */}
          {downloadProgress > 0 && downloadProgress < 100 && (
            <div className="absolute inset-0 bg-black/75 flex items-center justify-center">
              <div className="text-center text-white space-y-2">
                <Wifi className="w-8 h-8 mx-auto animate-pulse" />
                <p>Downloading via P2P...</p>
                <div className="w-48 bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
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
                  onClick={() => videoRef.current && (videoRef.current.currentTime -= 10)}
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
                  onClick={() => videoRef.current && (videoRef.current.currentTime += 10)}
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
            <TabsList className="grid w-full grid-cols-4">
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
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="file" className="space-y-4">
              <div className="text-center">
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
                  disabled={isSeeding}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {isSeeding ? 'Sharing File...' : 'Choose Video File'}
                </Button>
                {enableP2P && roomCode && (
                  <p className="text-sm text-muted-foreground mt-2">
                    P2P sharing enabled - your file will be shared directly with your partner
                  </p>
                )}
              </div>
              
              {currentFile && (
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Current: {currentFile.name}
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                      {currentMediaType.toUpperCase()}
                    </span>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="url" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="direct-url">Video URL (Vimeo, MP4, WebM, HLS)</Label>
                <Input
                  id="direct-url"
                  type="url"
                  placeholder="https://vimeo.com/123456789 or https://example.com/video.m3u8"
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
                  <p className="text-xs text-muted-foreground">
                    Quality applies to video calls. For video playback, quality depends on the source.
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