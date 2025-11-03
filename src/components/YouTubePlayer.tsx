import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface YouTubePlayerProps {
  videoId: string;
  onPlaybackUpdate?: (currentTime: number, isPlaying: boolean) => void;
  onDurationChange?: (duration: number) => void;
  onReadyControls?: (controls: { play: () => void; pause: () => void; seekTo: (s: number) => void; getCurrentTime: () => number; getPlayerState: () => any }) => void;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  videoId,
  onPlaybackUpdate,
  onDurationChange,
  onReadyControls
}) => {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [apiLoaded, setApiLoaded] = useState(false);
  const playIntervalRef = useRef<number | null>(null);
  const apiPollRef = useRef<number | null>(null);

  useEffect(() => {
    // Load YouTube IFrame API safely
    const ensureApiReady = () => {
      if (window.YT && typeof window.YT.Player === 'function') {
        setApiLoaded(true);
        return true;
      }
      return false;
    };

    if (!ensureApiReady()) {
      // Inject script only once
      if (!document.getElementById('youtube-iframe-api')) {
        const script = document.createElement('script');
        script.id = 'youtube-iframe-api';
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        document.body.appendChild(script);
      }

      // Define or wrap global callback
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        console.log('YouTube API ready');
        setApiLoaded(true);
        previous?.();
      };

      // Fallback: poll in case callback doesn't fire
      if (!apiPollRef.current) {
        apiPollRef.current = window.setInterval(() => {
          if (ensureApiReady()) {
            setApiLoaded(true);
            if (apiPollRef.current) {
              clearInterval(apiPollRef.current);
              apiPollRef.current = null;
            }
          }
        }, 300);
      }
    }

    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (error) {
          console.warn('Error destroying YouTube player:', error);
        }
      }
      if (apiPollRef.current) {
        clearInterval(apiPollRef.current);
        apiPollRef.current = null;
      }
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!apiLoaded || !containerRef.current || !videoId) return;

    // If player exists, just cue new video id
    if (playerRef.current && isReady) {
      try {
        playerRef.current.cueVideoById(videoId);
        const dur = playerRef.current.getDuration?.();
        if (dur) onDurationChange?.(dur);
      } catch (e) {
        console.warn('Error cueing new video, rebuilding player', e);
        try { playerRef.current.destroy(); } catch {}
        playerRef.current = null;
      }
      return;
    }

    console.log('Creating YouTube player for video:', videoId);

    try {
      playerRef.current = new window.YT.Player(containerRef.current, {
        height: '400',
        width: '100%',
        videoId: videoId,
        playerVars: {
          autoplay: 0,
          controls: 1,
          enablejsapi: 1,
          // origin intentionally omitted to avoid cross-origin strictness in preview iframes
          rel: 0,
          showinfo: 0,
          modestbranding: 1
        },
        events: {
          onReady: (event: any) => {
            console.log('YouTube player ready');
            setIsReady(true);
            const dur = event.target.getDuration?.();
            if (dur) onDurationChange?.(dur);
            // Expose controls to parent
            onReadyControls?.({
              play: () => event.target.playVideo(),
              pause: () => event.target.pauseVideo(),
              seekTo: (s: number) => event.target.seekTo(s, true),
              getCurrentTime: () => event.target.getCurrentTime(),
              getPlayerState: () => event.target.getPlayerState()
            });
          },
          onStateChange: (event: any) => {
            const player = event.target;
            const state = event.data;

            // Clear previous interval
            if (playIntervalRef.current) {
              clearInterval(playIntervalRef.current);
              playIntervalRef.current = null;
            }

            // YT.PlayerState: UNSTARTED (-1), ENDED (0), PLAYING (1), PAUSED (2), BUFFERING (3), CUED (5)
            switch (state) {
              case window.YT.PlayerState.PLAYING: {
                onPlaybackUpdate?.(player.getCurrentTime(), true);
                // Emit periodic updates while playing
                playIntervalRef.current = window.setInterval(() => {
                  try {
                    onPlaybackUpdate?.(player.getCurrentTime(), true);
                  } catch {}
                }, 500);
                break;
              }
              case window.YT.PlayerState.PAUSED:
                onPlaybackUpdate?.(player.getCurrentTime(), false);
                break;
              case window.YT.PlayerState.ENDED:
                onPlaybackUpdate?.(player.getCurrentTime(), false);
                break;
            }
          },
          onError: (event: any) => {
            console.error('YouTube player error:', event.data);
            // Handle different error codes
            switch (event.data) {
              case 2:
                console.error('Invalid video ID');
                break;
              case 5:
                console.error('HTML5 player error');
                break;
              case 100:
                console.error('Video not found or private');
                break;
              case 101:
              case 150:
                console.error('Embedding disabled by video owner');
                break;
            }
          }
        }
      });
    } catch (error) {
      console.error('Failed to create YouTube player:', error);
    }
  }, [apiLoaded, videoId, onPlaybackUpdate, onDurationChange, onReadyControls, isReady]);

  // Sync methods that can be called from parent
  const play = () => {
    if (playerRef.current && isReady) {
      playerRef.current.playVideo();
    }
  };

  const pause = () => {
    if (playerRef.current && isReady) {
      playerRef.current.pauseVideo();
    }
  };

  const seekTo = (seconds: number) => {
    if (playerRef.current && isReady) {
      playerRef.current.seekTo(seconds, true);
    }
  };

  const getCurrentTime = () => {
    if (playerRef.current && isReady) {
      return playerRef.current.getCurrentTime();
    }
    return 0;
  };

  const getPlayerState = () => {
    if (playerRef.current && isReady) {
      return playerRef.current.getPlayerState();
    }
    return -1;
  };

  // Expose methods for parent component
  useEffect(() => {
    if (containerRef.current && playerRef.current) {
      (containerRef.current as any).youTubePlayer = {
        play,
        pause,
        seekTo,
        getCurrentTime,
        getPlayerState
      };
    }
  }, [isReady]);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="relative">
          {!apiLoaded && (
            <div className="flex items-center justify-center h-64 bg-black/10">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading YouTube player...</p>
              </div>
            </div>
          )}
          
          <div 
            ref={containerRef}
            className={`w-full ${!apiLoaded ? 'hidden' : ''}`}
            style={{ aspectRatio: '16/9' }}
            aria-label="YouTube player container"
          />
        </div>
        
        <div className="p-4 bg-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">YouTube Video</h3>
              <p className="text-sm text-muted-foreground">
                YouTube playback synced automatically
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};