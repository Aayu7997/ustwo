import React, { useState } from 'react';
import { ProductionVideoPlayer } from './ProductionVideoPlayer';
import { StableVideoCallOverlay } from './StableVideoCallOverlay';
import { ReactionOverlay } from './ReactionOverlay';
import { VideoQueue } from './VideoQueue';
import { TimestampedNotes } from './TimestampedNotes';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Copy, Check, Users, Heart } from 'lucide-react';
import { motion } from 'framer-motion';
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
  roomId,
  roomCode,
  isRoomCreator,
  partnerId,
  partnerName = 'Partner',
  onPlaybackStateChange
}) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState('');
  const [copied, setCopied] = useState(false);

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

  const copyRoomLink = async () => {
    if (!roomCode) return;
    const link = `${window.location.origin}/room/${roomCode}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast({ title: 'Link copied!', description: 'Share this link with your partner' });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({ title: 'Failed to copy', description: 'Please copy the link manually', variant: 'destructive' });
    }
  };

  return (
    <div className="relative w-full space-y-6">
      {/* Room Info Bar */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between flex-wrap gap-3"
      >
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="gap-2 py-1.5 px-3">
            <Users className="w-4 h-4" />
            Room: {roomCode || 'Loading...'}
          </Badge>
          <Badge variant="outline" className="gap-2 py-1.5 px-3">
            <Heart className="w-4 h-4 text-primary" />
            {isRoomCreator ? 'Host' : 'Synced'}
          </Badge>
        </div>
        
        {roomCode && (
          <Button
            onClick={copyRoomLink}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy Link'}
          </Button>
        )}
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main Video Player */}
        <div className="xl:col-span-2 space-y-4">
          <ProductionVideoPlayer
            roomId={roomId}
            roomCode={roomCode}
            isRoomCreator={isRoomCreator}
            onPlaybackStateChange={handlePlaybackUpdate}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <VideoQueue
            roomId={roomId}
            onPlayVideo={handlePlayVideo}
            currentVideoUrl={currentVideoUrl}
          />
          <TimestampedNotes
            roomId={roomId}
            currentTime={currentTime}
            onSeekToTime={handleSeekToTime}
          />
        </div>
      </div>

      {/* Reaction Overlay */}
      <ReactionOverlay
        roomId={roomId}
        currentVideoTime={currentTime}
        isPlaying={isPlaying}
      />

      {/* Video Call Overlay - Self-managed call initiation */}
      <StableVideoCallOverlay
        roomId={roomId}
        partnerId={partnerId}
        partnerName={partnerName}
      />
    </div>
  );
};
