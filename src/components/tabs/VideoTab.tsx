import React from 'react';
import { motion } from 'framer-motion';
import { ProductionIntegratedPlayer } from '@/components/ProductionIntegratedPlayer';

interface VideoTabProps {
  roomId: string;
  roomCode?: string;
  isRoomCreator?: boolean;
  partnerId?: string | null;
  partnerName?: string;
  onPlaybackStateChange?: (state: any) => void;
}

export const VideoTab: React.FC<VideoTabProps> = ({ 
  roomId, 
  roomCode, 
  isRoomCreator = false,
  partnerId,
  partnerName,
  onPlaybackStateChange 
}) => {
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
          {isRoomCreator 
            ? "You're the host! Control playback for both of you. Upload files, paste YouTube/Vimeo links, or stream P2P."
            : "You're synced with your partner. Playback is controlled by the host."
          }
        </p>
      </div>
      
      <ProductionIntegratedPlayer 
        roomId={roomId}
        roomCode={roomCode}
        isRoomCreator={isRoomCreator}
        partnerId={partnerId}
        partnerName={partnerName}
        onPlaybackStateChange={onPlaybackStateChange}
      />
    </motion.div>
  );
};
