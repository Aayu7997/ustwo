import React from 'react';
import { motion } from 'framer-motion';
import { CoupleGamesPanel } from '@/components/CoupleGamesPanel';

interface GamesTabProps {
  roomId: string;
  partnerId?: string | null;
}

export const GamesTab: React.FC<GamesTabProps> = ({ roomId, partnerId }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Couple Games 🎮</h2>
        <p className="text-muted-foreground">
          Play fun games together and strengthen your bond!
        </p>
      </div>
      
      <CoupleGamesPanel roomId={roomId} partnerId={partnerId} />
    </motion.div>
  );
};
