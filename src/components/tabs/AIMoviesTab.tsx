import React from 'react';
import { motion } from 'framer-motion';
import { AIRecommendations } from '@/components/AIRecommendations';

interface AIMoviesTabProps {
  roomId: string;
  roomCode: string;
  partnerId?: string;
}

export const AIMoviesTab: React.FC<AIMoviesTabProps> = ({ roomId, roomCode, partnerId }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">AI Movie Recommendations</h2>
        <p className="text-muted-foreground">
          Personalized picks based on your preferences and watch history
        </p>
      </div>
      
      <AIRecommendations 
        roomId={roomId}
        roomCode={roomCode}
        partnerId={partnerId}
      />
    </motion.div>
  );
};
