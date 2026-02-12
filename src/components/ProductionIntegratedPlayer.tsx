import React, { useState } from 'react';
import { ProductionVideoPlayer } from './ProductionVideoPlayer';
import { ReactionOverlay } from './ReactionOverlay';
import { VideoQueue } from './VideoQueue';
import { TimestampedNotes } from './TimestampedNotes';
import { toast } from '@/hooks/use-toast';

interface ProductionIntegratedPlayerProps {
  roomId: string;
  roomCode?: string;
  isRoomCreator: boolean;
  partnerId?: string | null;
  partnerName?: string;
  onPlaybackStateChange?: (state: any) => void;
}

export const ProductionIntegratedPlayer: React.FC<ProductionIntegratedPlayerProps> = ({
  roomId, roomCode, isRoomCreator, partnerId,
  partnerName = 'Partner', onPlaybackStateChange
}) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState('');

  const handlePlaybackUpdate = (state: any) => {
    setCurrentTime(state.current_time_seconds || 0);
    setIsPlaying(state.is_playing || false);
    onPlaybackStateChange?.(state);
  };

  const handlePlayVideo = (url: string, type: string) => {
    setCurrentVideoUrl(url);
  };

  const handleSeekToTime = (time: number) => {
    toast({ title: 'Seeking...', description: `Jumping to ${Math.floor(time)}s` });
  };

  return (
    <div className="relative w-full space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <ProductionVideoPlayer
            roomId={roomId}
            roomCode={roomCode}
            isRoomCreator={isRoomCreator}
            onPlaybackStateChange={handlePlaybackUpdate}
          />
        </div>
        <div className="space-y-4">
          <VideoQueue roomId={roomId} onPlayVideo={handlePlayVideo} currentVideoUrl={currentVideoUrl} />
          <TimestampedNotes roomId={roomId} currentTime={currentTime} onSeekToTime={handleSeekToTime} />
        </div>
      </div>

      <ReactionOverlay roomId={roomId} currentVideoTime={currentTime} isPlaying={isPlaying} />
    </div>
  );
};
