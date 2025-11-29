import React from 'react';
import { motion } from 'framer-motion';
import { WatchlistManager } from '@/components/WatchlistManager';

interface WatchlistTabProps {
  roomId: string;
  onPlayVideo?: (url: string, type: string) => void;
}

export const WatchlistTab: React.FC<WatchlistTabProps> = ({ roomId, onPlayVideo }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <WatchlistManager roomId={roomId} onPlayVideo={onPlayVideo} />
    </motion.div>
  );
};