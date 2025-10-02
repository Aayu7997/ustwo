import React from 'react';
import { motion } from 'framer-motion';
import { VideoCall } from '@/components/VideoCall';

interface CallTabProps {
  roomId: string;
  roomCode?: string;
}

export const CallTab: React.FC<CallTabProps> = ({ roomId, roomCode }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Video Call</h2>
        <p className="text-muted-foreground">
          See and talk to your partner while watching together
        </p>
      </div>
      
      <VideoCall roomId={roomId} roomCode={roomCode} />
    </motion.div>
  );
};
