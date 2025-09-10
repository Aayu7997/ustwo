import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface YouTubePlayerProps {
  videoId: string;
  onPlaybackUpdate?: (currentTime: number, isPlaying: boolean) => void;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  videoId,
  onPlaybackUpdate
}) => {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [apiLoaded, setApiLoaded] = useState(false);

  useEffect(() => {
    // Load YouTube IFrame API
    if (!window.YT) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      document.body.appendChild(script);

      window.onYouTubeIframeAPIReady = () => {
        console.log('YouTube API ready');
        setApiLoaded(true);
      };
    } else {
      setApiLoaded(true);
    }

    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (error) {
          console.warn('Error destroying YouTube player:', error);
        }
      }
    };
  }, []);

  useEffect(() => {
    if (!apiLoaded || !containerRef.current || !videoId) return;

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
          origin: window.location.origin,
          rel: 0,
          showinfo: 0,
          modestbranding: 1
        },
        events: {
          onReady: (event: any) => {
            console.log('YouTube player ready');
            setIsReady(true);
          },
          onStateChange: (event: any) => {
            const player = event.target;
            const currentTime = player.getCurrentTime();
            const state = event.data;

            console.log('YouTube state change:', state, 'time:', currentTime);

            // YT.PlayerState: UNSTARTED (-1), ENDED (0), PLAYING (1), PAUSED (2), BUFFERING (3), CUED (5)
            switch (state) {
              case window.YT.PlayerState.PLAYING:
                onPlaybackUpdate?.(currentTime, true);
                break;
              case window.YT.PlayerState.PAUSED:
                onPlaybackUpdate?.(currentTime, false);
                break;
              case window.YT.PlayerState.ENDED:
                onPlaybackUpdate?.(currentTime, false);
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
  }, [apiLoaded, videoId, onPlaybackUpdate]);

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