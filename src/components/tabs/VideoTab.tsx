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
  roomId, roomCode, isRoomCreator = false,
  partnerId, partnerName, onPlaybackStateChange 
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
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
