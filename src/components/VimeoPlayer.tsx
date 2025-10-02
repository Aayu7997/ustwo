import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface VimeoPlayerProps {
  videoId: string;
  onPlaybackUpdate?: (currentTime: number, isPlaying: boolean) => void;
}

declare global {
  interface Window {
    Vimeo: any;
  }
}

export const VimeoPlayer: React.FC<VimeoPlayerProps> = ({
  videoId,
  onPlaybackUpdate
}) => {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [apiLoaded, setApiLoaded] = useState(false);

  useEffect(() => {
    // Load Vimeo Player API
    if (!window.Vimeo) {
      const script = document.createElement('script');
      script.src = 'https://player.vimeo.com/api/player.js';
      script.async = true;
      script.onload = () => {
        console.log('Vimeo Player API loaded');
        setApiLoaded(true);
      };
      document.body.appendChild(script);
    } else {
      setApiLoaded(true);
    }

    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (error) {
          console.warn('Error destroying Vimeo player:', error);
        }
      }
    };
  }, []);

  useEffect(() => {
    if (!apiLoaded || !containerRef.current || !videoId) return;

    console.log('Creating Vimeo player for video:', videoId);

    try {
      const iframe = document.createElement('iframe');
      iframe.src = `https://player.vimeo.com/video/${videoId}`;
      iframe.style.width = '100%';
      iframe.style.height = '400px';
      iframe.setAttribute('frameborder', '0');
      iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture');
      iframe.setAttribute('allowfullscreen', '');
      
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(iframe);

      playerRef.current = new window.Vimeo.Player(iframe);

      playerRef.current.ready().then(() => {
        console.log('Vimeo player ready');
        setIsReady(true);
      });

      // Event listeners
      playerRef.current.on('play', async () => {
        const time = await playerRef.current.getCurrentTime();
        console.log('Vimeo playing at:', time);
        onPlaybackUpdate?.(time, true);
      });

      playerRef.current.on('pause', async () => {
        const time = await playerRef.current.getCurrentTime();
        console.log('Vimeo paused at:', time);
        onPlaybackUpdate?.(time, false);
      });

      playerRef.current.on('ended', async () => {
        const time = await playerRef.current.getCurrentTime();
        console.log('Vimeo ended');
        onPlaybackUpdate?.(time, false);
      });

      playerRef.current.on('error', (error: any) => {
        console.error('Vimeo player error:', error);
      });

    } catch (error) {
      console.error('Failed to create Vimeo player:', error);
    }
  }, [apiLoaded, videoId, onPlaybackUpdate]);

  // Expose methods for parent component
  useEffect(() => {
    if (containerRef.current && playerRef.current && isReady) {
      (containerRef.current as any).vimeoPlayer = {
        play: () => playerRef.current.play(),
        pause: () => playerRef.current.pause(),
        seekTo: (seconds: number) => playerRef.current.setCurrentTime(seconds),
        getCurrentTime: () => playerRef.current.getCurrentTime(),
        getPaused: () => playerRef.current.getPaused()
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
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading Vimeo player...</p>
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
              <h3 className="font-medium">Vimeo Video</h3>
              <p className="text-sm text-muted-foreground">
                Vimeo playback synced automatically
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
