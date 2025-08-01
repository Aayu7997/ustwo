import React, { useEffect, useRef, useState } from 'react';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { useSmartSync } from '@/hooks/useSmartSync';
import { useRoomPresence } from '@/hooks/useRoomPresence';
import { PlaybackState } from '@/hooks/useRoom';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';

interface MediaPlayerProps {
  roomId: string;
  videoUrl?: string;
  onPlaybackStateChange?: (state: PlaybackState) => void;
}

export const MediaPlayer: React.FC<MediaPlayerProps> = ({
  roomId,
  videoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  onPlaybackStateChange
}) => {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<Plyr | null>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncTimeRef = useRef<number>(0);
  const userInitiatedRef = useRef<boolean>(false);
  const { updateStatus } = useRoomPresence(roomId);

  const handlePlaybackUpdate = (state: PlaybackState) => {
    if (!playerRef.current || !user) return;

    // Don't sync if this user made the change
    if (state.last_updated_by === user.id) return;

    const player = playerRef.current;
    const currentTime = player.currentTime;
    const timeDrift = Math.abs(currentTime - state.current_time_seconds);

    // Resync if drift > 1 second
    if (timeDrift > 1) {
      console.log(`Resyncing: drift of ${timeDrift}s detected`);
      player.currentTime = state.current_time_seconds;
    }

    // Update play/pause state
    if (state.is_playing && player.paused) {
      userInitiatedRef.current = false;
      player.play();
    } else if (!state.is_playing && !player.paused) {
      userInitiatedRef.current = false;
      player.pause();
    }

    onPlaybackStateChange?.(state);
  };

  const handleMediaSync = (currentTime: number, isPlaying: boolean) => {
    if (!playerRef.current) return;

    const player = playerRef.current;
    const timeDrift = Math.abs(player.currentTime - currentTime);

    // Only sync if there's significant drift and it wasn't user-initiated
    if (timeDrift > 1 && !userInitiatedRef.current) {
      player.currentTime = currentTime;
    }

    // Reset user-initiated flag
    userInitiatedRef.current = false;
  };

  const handleSyncEvent = (event: any) => {
    if (!playerRef.current) return;

    const player = playerRef.current;
    
    switch (event.type) {
      case 'play':
        if (player.paused) {
          player.play();
          toast({
            title: "Sync Event",
            description: "Partner started playing",
          });
        }
        break;
      case 'pause':
        if (!player.paused) {
          player.pause();
          toast({
            title: "Sync Event", 
            description: "Partner paused",
          });
        }
        break;
      case 'seek':
        const timeDrift = Math.abs(player.currentTime - event.currentTime);
        if (timeDrift > 1) {
          player.currentTime = event.currentTime;
          toast({
            title: "Sync Event",
            description: "Partner seeked to new position",
          });
        }
        break;
      case 'buffering':
        updateStatus('buffering');
        toast({
          title: "Sync Event",
          description: "Partner is buffering",
        });
        break;
    }
  };

  const { sendPlaybackUpdate, sendSyncEvent } = useRealtimeSync({
    roomId,
    onPlaybackUpdate: handlePlaybackUpdate,
    onMediaSync: handleMediaSync,
    onSyncEvent: handleSyncEvent
  });

  const { metrics, isAutoSyncing, onBuffering, updateSyncTime } = useSmartSync(
    (targetTime) => {
      if (playerRef.current) {
        playerRef.current.currentTime = targetTime;
      }
    },
    () => playerRef.current?.currentTime || 0,
    !playerRef.current?.paused
  );

  useEffect(() => {
    if (!videoRef.current) return;

    // Initialize Plyr
    const player = new Plyr(videoRef.current, {
      controls: [
        'play-large',
        'play',
        'progress',
        'current-time',
        'duration',
        'mute',
        'volume',
        'settings',
        'fullscreen'
      ],
      settings: ['quality', 'speed'],
      quality: {
        default: 720,
        options: [1080, 720, 480, 360]
      }
    });

    playerRef.current = player;

    // Player event listeners
    player.on('ready', () => {
      console.log('Player ready');
      setIsPlayerReady(true);
    });

    player.on('play', () => {
      console.log('Play event');
      userInitiatedRef.current = true;
      updateStatus('watching');
      sendPlaybackUpdate(player.currentTime, true);
      sendSyncEvent('play', player.currentTime, true);
    });

    player.on('pause', () => {
      console.log('Pause event');
      userInitiatedRef.current = true;
      updateStatus('paused');
      sendPlaybackUpdate(player.currentTime, false);
      sendSyncEvent('pause', player.currentTime, false);
    });

    player.on('seeked', () => {
      console.log('Seeked event');
      userInitiatedRef.current = true;
      sendPlaybackUpdate(player.currentTime, !player.paused);
      sendSyncEvent('seek', player.currentTime, !player.paused);
      updateSyncTime(player.currentTime);
    });

    player.on('waiting', () => {
      console.log('Buffering event');
      updateStatus('buffering');
      onBuffering();
      sendSyncEvent('buffering', player.currentTime, !player.paused);
    });

    player.on('canplay', () => {
      console.log('Can play event');
      updateStatus(player.paused ? 'paused' : 'watching');
      sendSyncEvent('loaded', player.currentTime, !player.paused);
    });

    // Sync every 500ms during playback
    const startSyncInterval = () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
      
      syncIntervalRef.current = setInterval(() => {
        if (player && !player.paused) {
          const currentTime = player.currentTime;
          // Only sync if enough time has passed since last sync
          if (Date.now() - lastSyncTimeRef.current > 450) {
            sendPlaybackUpdate(currentTime, true);
            lastSyncTimeRef.current = Date.now();
          }
        }
      }, 500);
    };

    player.on('playing', startSyncInterval);
    player.on('pause', () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    });

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
      if (player) {
        player.destroy();
      }
    };
  }, [roomId, sendPlaybackUpdate, sendSyncEvent, updateStatus]);

  return (
    <div className="w-full max-w-4xl mx-auto">
      <video
        ref={videoRef}
        className="w-full rounded-lg shadow-lg"
        controls
        crossOrigin="anonymous"
        playsInline
      >
        <source src={videoUrl} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      
      {!isPlayerReady && (
        <div className="flex items-center justify-center h-64 bg-muted rounded-lg">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-muted-foreground">Loading player...</p>
          </div>
        </div>
      )}
    </div>
  );
};