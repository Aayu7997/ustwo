import React from 'react';
import { motion } from 'framer-motion';
import { EnhancedVideoPlayer } from '@/components/EnhancedVideoPlayer';

interface VideoTabProps {
  roomId: string;
  roomCode?: string;
  onPlaybackStateChange?: (state: any) => void;
}

export const VideoTab: React.FC<VideoTabProps> = ({ roomId, roomCode, onPlaybackStateChange }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Watch Together</h2>
        <p className="text-muted-foreground">
          Playback is automatically synchronized. Upload files, paste YouTube/Vimeo links, or use WebTorrent.
        </p>
      </div>
      
      <EnhancedVideoPlayer 
        roomId={roomId}
        roomCode={roomCode}
        onPlaybackStateChange={onPlaybackStateChange}
      />
    </motion.div>
  );
};
