import React, { useState } from 'react';
import { EnhancedVideoPlayer } from './EnhancedVideoPlayer';
import { EnhancedVideoCallOverlay } from './EnhancedVideoCallOverlay';
import { ReactionOverlay } from './ReactionOverlay';
import { VideoQueue } from './VideoQueue';
import { TimestampedNotes } from './TimestampedNotes';
import { Button } from './ui/button';
import { Video, Phone, Copy, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from '@/hooks/use-toast';

interface IntegratedVideoPlayerProps {
  roomId: string;
  roomCode?: string;
  onPlaybackStateChange?: (state: any) => void;
}

export const IntegratedVideoPlayer: React.FC<IntegratedVideoPlayerProps> = ({
  roomId,
  roomCode,
  onPlaybackStateChange
}) => {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isVoiceOnly, setIsVoiceOnly] = useState(false);
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
    // Store the video URL to highlight in queue
    setCurrentVideoUrl(url);
  };

  const handleSeekToTime = (time: number) => {
    // Note: EnhancedVideoPlayer will handle seeking via its sync system
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
      {/* Copy Room Link Button */}
      {roomCode && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-center"
        >
          <Button
            onClick={copyRoomLink}
            variant="outline"
            className="gap-2"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Link Copied!' : 'Copy Room Link'}
          </Button>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Video Player */}
        <div className="lg:col-span-2 space-y-4">
          <EnhancedVideoPlayer
            roomId={roomId}
            roomCode={roomCode}
            onPlaybackStateChange={handlePlaybackUpdate}
          />

          {/* Call Toggle Buttons */}
          {!isCallActive && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-center gap-3"
            >
              <Button
                onClick={() => {
                  setIsVoiceOnly(false);
                  setIsCallActive(true);
                }}
                className="flex items-center gap-2 bg-gradient-to-r from-love-pink to-love-purple hover:from-love-pink/90 hover:to-love-purple/90 text-white shadow-lg"
                size="lg"
              >
                <Video className="w-5 h-5" />
                Start Video Call
              </Button>
              <Button
                onClick={() => {
                  setIsVoiceOnly(true);
                  setIsCallActive(true);
                }}
                variant="outline"
                className="flex items-center gap-2"
                size="lg"
              >
                <Phone className="w-5 h-5" />
                Voice Only
              </Button>
            </motion.div>
          )}
        </div>

        {/* Sidebar - Queue and Notes */}
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

      {/* Video Call Overlay (PiP) */}
      <EnhancedVideoCallOverlay
        roomId={roomId}
        roomCode={roomCode}
        isActive={isCallActive}
        voiceOnly={isVoiceOnly}
        onClose={() => setIsCallActive(false)}
      />
    </div>
  );
};
