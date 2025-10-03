import React, { useState } from 'react';
import { EnhancedVideoPlayer } from './EnhancedVideoPlayer';
import { VideoCallOverlay } from './VideoCallOverlay';
import { Button } from './ui/button';
import { Video } from 'lucide-react';
import { motion } from 'framer-motion';

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

  return (
    <div className="relative w-full">
      {/* Main Video Player */}
      <EnhancedVideoPlayer
        roomId={roomId}
        roomCode={roomCode}
        onPlaybackStateChange={onPlaybackStateChange}
      />

      {/* Video Call Toggle Button */}
      {!isCallActive && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 flex justify-center"
        >
          <Button
            onClick={() => setIsCallActive(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-love-pink to-love-purple hover:from-love-pink/90 hover:to-love-purple/90 text-white shadow-lg"
            size="lg"
          >
            <Video className="w-5 h-5" />
            Start Video Call
          </Button>
        </motion.div>
      )}

      {/* Video Call Overlay (PiP) */}
      <VideoCallOverlay
        roomId={roomId}
        roomCode={roomCode}
        isActive={isCallActive}
        onClose={() => setIsCallActive(false)}
      />
    </div>
  );
};
