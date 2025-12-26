import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';

interface RobustYouTubePlayerProps {
  videoId: string;
  onPlaybackUpdate?: (currentTime: number, isPlaying: boolean) => void;
  onDurationChange?: (duration: number) => void;
  onReady?: () => void;
  onReadyControls?: (controls: {
    play: () => void;
    pause: () => void;
    seekTo: (s: number) => void;
    getCurrentTime: () => number;
    getPlayerState: () => number;
  }) => void;
  onError?: (error: string) => void;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export const RobustYouTubePlayer: React.FC<RobustYouTubePlayerProps> = ({
  videoId,
  onPlaybackUpdate,
  onDurationChange,
  onReady,
  onReadyControls,
  onError
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const playIntervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const apiCheckRef = useRef<NodeJS.Timeout | null>(null);
  
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  // Get proper origin for localhost support
  const getOrigin = useCallback(() => {
    const origin = window.location.origin;
    // For localhost, use the full origin including port
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return origin;
    }
    return origin;
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (apiCheckRef.current) {
      clearInterval(apiCheckRef.current);
      apiCheckRef.current = null;
    }
  }, []);

  // Create controls object
  const createControls = useCallback((player: any, isFallback = false) => {
    const controls = {
      play: () => {
        try {
          if (isFallback && iframeRef.current) {
            iframeRef.current.contentWindow?.postMessage(
              '{"event":"command","func":"playVideo","args":""}',
              '*'
            );
          } else {
            player?.playVideo?.();
          }
        } catch (e) {
          console.error('[YT] Play failed:', e);
        }
      },
      pause: () => {
        try {
          if (isFallback && iframeRef.current) {
            iframeRef.current.contentWindow?.postMessage(
              '{"event":"command","func":"pauseVideo","args":""}',
              '*'
            );
          } else {
            player?.pauseVideo?.();
          }
        } catch (e) {
          console.error('[YT] Pause failed:', e);
        }
      },
      seekTo: (seconds: number) => {
        try {
          if (isFallback && iframeRef.current) {
            iframeRef.current.contentWindow?.postMessage(
              `{"event":"command","func":"seekTo","args":[${seconds}, true]}`,
              '*'
            );
          } else {
            player?.seekTo?.(seconds, true);
          }
        } catch (e) {
          console.error('[YT] Seek failed:', e);
        }
      },
      getCurrentTime: () => {
        try {
          return player?.getCurrentTime?.() || 0;
        } catch {
          return 0;
        }
      },
      getPlayerState: () => {
        try {
          return player?.getPlayerState?.() ?? -1;
        } catch {
          return -1;
        }
      }
    };
    return controls;
  }, []);

  // Use fallback iframe embed
  const useFallback = useCallback(() => {
    console.log('[YT] Using iframe fallback');
    
    if (!containerRef.current) return;
    
    containerRef.current.innerHTML = '';
    
    const origin = getOrigin();
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${encodeURIComponent(origin)}&playsinline=1&rel=0&modestbranding=1&autoplay=0`;
    iframe.width = '100%';
    iframe.height = '100%';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen = true;
    iframe.style.border = 'none';
    
    containerRef.current.appendChild(iframe);
    iframeRef.current = iframe;
    
    setStatus('fallback');
    onDurationChange?.(0);
    
    const controls = createControls(null, true);
    onReadyControls?.(controls);
    onReady?.();
  }, [videoId, getOrigin, createControls, onDurationChange, onReady, onReadyControls]);

  // Initialize with API or fallback
  useEffect(() => {
    if (!videoId || !containerRef.current) return;

    cleanup();
    setStatus('loading');
    setErrorMessage(null);
    setAutoplayBlocked(false);

    let mounted = true;
    let playerInitialized = false;

    const initPlayer = () => {
      if (!containerRef.current || !mounted || playerInitialized) return;
      playerInitialized = true;

      try {
        // Destroy existing player
        if (playerRef.current) {
          try { playerRef.current.destroy(); } catch {}
          playerRef.current = null;
        }

        // Clear container
        containerRef.current.innerHTML = '';
        
        // Create a new div for the player
        const playerDiv = document.createElement('div');
        playerDiv.id = `yt-player-${videoId}-${Date.now()}`;
        containerRef.current.appendChild(playerDiv);

        const origin = getOrigin();
        console.log('[YT] Creating player for:', videoId, 'origin:', origin);

        playerRef.current = new window.YT.Player(playerDiv, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 0,
            controls: 1,
            enablejsapi: 1,
            origin: origin,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            iv_load_policy: 3,
            fs: 1
          },
          events: {
            onReady: (event: any) => {
              if (!mounted) return;
              console.log('[YT] Player ready');
              setStatus('ready');
              
              const duration = event.target.getDuration?.();
              if (duration) onDurationChange?.(duration);
              
              const controls = createControls(event.target, false);
              onReadyControls?.(controls);
              onReady?.();
            },
            onStateChange: (event: any) => {
              if (!mounted) return;
              const player = event.target;
              const state = event.data;

              if (playIntervalRef.current) {
                clearInterval(playIntervalRef.current);
                playIntervalRef.current = null;
              }

              if (state === window.YT.PlayerState.PLAYING) {
                onPlaybackUpdate?.(player.getCurrentTime(), true);
                playIntervalRef.current = window.setInterval(() => {
                  try {
                    if (mounted) onPlaybackUpdate?.(player.getCurrentTime(), true);
                  } catch {}
                }, 500);
              } else if (state === window.YT.PlayerState.PAUSED) {
                onPlaybackUpdate?.(player.getCurrentTime(), false);
              } else if (state === window.YT.PlayerState.ENDED) {
                onPlaybackUpdate?.(player.getCurrentTime(), false);
              }
            },
            onError: (event: any) => {
              if (!mounted) return;
              const errorCode = event.data;
              console.error('[YT] Player error:', errorCode);
              
              const errorMessages: Record<number, string> = {
                2: 'Invalid video ID',
                5: 'HTML5 player error',
                100: 'Video not found or private',
                101: 'Embedding disabled by owner',
                150: 'Embedding disabled by owner'
              };
              
              const message = errorMessages[errorCode] || `Player error: ${errorCode}`;
              setErrorMessage(message);
              setStatus('error');
              onError?.(message);
            }
          }
        });
      } catch (error) {
        console.error('[YT] Failed to create player:', error);
        if (mounted) useFallback();
      }
    };

    const triggerFallback = () => {
      if (mounted && !playerInitialized) {
        console.log('[YT] API timeout, using fallback');
        if (apiCheckRef.current) {
          clearInterval(apiCheckRef.current);
          apiCheckRef.current = null;
        }
        useFallback();
      }
    };

    // Check if API is ready
    if (window.YT && typeof window.YT.Player === 'function') {
      console.log('[YT] API already loaded, initializing player');
      initPlayer();
    } else {
      // Load API with timeout
      if (!document.getElementById('youtube-iframe-api')) {
        const script = document.createElement('script');
        script.id = 'youtube-iframe-api';
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        document.body.appendChild(script);
      }

      // Set up callback
      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        console.log('[YT] API ready callback fired');
        prevCallback?.();
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        if (mounted && !playerInitialized) initPlayer();
      };

      // Poll for API readiness (backup)
      apiCheckRef.current = setInterval(() => {
        if (window.YT && typeof window.YT.Player === 'function') {
          console.log('[YT] API detected via polling');
          clearInterval(apiCheckRef.current!);
          apiCheckRef.current = null;
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          if (mounted && !playerInitialized) initPlayer();
        }
      }, 200);

      // 5-second timeout for fallback
      timeoutRef.current = setTimeout(triggerFallback, 5000);
    }

    return () => {
      mounted = false;
      cleanup();
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch {}
        playerRef.current = null;
      }
    };
  }, [videoId]); // Only depend on videoId - removed status to prevent loops

  // Handle autoplay unlock
  const handleUnlockAutoplay = () => {
    setAutoplayBlocked(false);
    if (playerRef.current) {
      try {
        playerRef.current.playVideo();
      } catch {}
    } else if (iframeRef.current) {
      iframeRef.current.contentWindow?.postMessage(
        '{"event":"command","func":"playVideo","args":""}',
        '*'
      );
    }
  };

  // Retry with API
  const handleRetry = () => {
    setStatus('loading');
    setErrorMessage(null);
    // Force re-mount by changing key
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }
  };

  // Open in YouTube
  const handleOpenInYouTube = () => {
    window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="relative" style={{ aspectRatio: '16/9' }}>
          {/* Loading state */}
          {status === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
              <div className="text-center text-white">
                <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p>Loading YouTube player...</p>
                <p className="text-sm text-muted-foreground mt-2">
                  {window.location.hostname.includes('localhost') && 
                    'Localhost mode - using compatible settings'}
                </p>
              </div>
            </div>
          )}

          {/* Error state */}
          {status === 'error' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-10">
              <div className="text-center text-white space-y-4 p-6">
                <AlertCircle className="w-12 h-12 mx-auto text-red-500" />
                <p className="font-medium">{errorMessage || 'Failed to load video'}</p>
                <div className="flex gap-2 justify-center">
                  <Button onClick={handleRetry} variant="outline" className="gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Try Again
                  </Button>
                  <Button onClick={handleOpenInYouTube} variant="secondary" className="gap-2">
                    <ExternalLink className="w-4 h-4" />
                    Open in YouTube
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Autoplay blocked overlay */}
          {autoplayBlocked && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
              <Button onClick={handleUnlockAutoplay} size="lg" className="gap-2">
                <Play className="w-5 h-5" />
                Click to Play
              </Button>
            </div>
          )}

          {/* Player container */}
          <div 
            ref={containerRef}
            className="w-full h-full"
          />
        </div>

        <div className="p-4 bg-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">YouTube Video</h3>
              <p className="text-sm text-muted-foreground">
                {status === 'fallback' 
                  ? 'Basic playback mode (limited sync)' 
                  : status === 'ready'
                  ? 'Synced playback ready'
                  : status === 'error'
                  ? errorMessage
                  : 'Loading...'}
              </p>
            </div>
            {status === 'fallback' && (
              <Button onClick={handleRetry} variant="ghost" size="sm" className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Retry API
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
