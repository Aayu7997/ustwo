import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoReactions, ReactionType } from '@/hooks/useVideoReactions';
import { Button } from './ui/button';

interface ReactionOverlayProps {
  roomId: string;
  currentVideoTime: number;
  isPlaying: boolean;
}

export const ReactionOverlay: React.FC<ReactionOverlayProps> = ({
  roomId,
  currentVideoTime,
  isPlaying
}) => {
  const { reactions, sendReaction, subscribeToReactions } = useVideoReactions(roomId);

  useEffect(() => {
    const unsubscribe = subscribeToReactions();
    return unsubscribe;
  }, [subscribeToReactions]);

  const reactionButtons: ReactionType[] = ['❤️', '😂', '😮', '👍', '😢', '🔥'];

  return (
    <>
      {/* Reaction Buttons */}
      <div className="absolute bottom-20 right-4 flex flex-col gap-2 z-10">
        {reactionButtons.map((reaction) => (
          <motion.div
            key={reaction}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => sendReaction(reaction, currentVideoTime)}
              className="w-12 h-12 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm text-2xl"
            >
              {reaction}
            </Button>
          </motion.div>
        ))}
      </div>

      {/* Floating Reactions */}
      <AnimatePresence>
        {reactions.map((reaction) => (
          <motion.div
            key={reaction.id}
            initial={{ 
              opacity: 0, 
              y: 0, 
              x: Math.random() * 200 - 100,
              scale: 0.5 
            }}
            animate={{ 
              opacity: [0, 1, 1, 0], 
              y: -200, 
              x: Math.random() * 100 - 50,
              scale: [0.5, 1.5, 1, 0.8],
              rotate: Math.random() * 30 - 15
            }}
            exit={{ opacity: 0 }}
            transition={{ 
              duration: 3,
              ease: "easeOut"
            }}
            className="absolute bottom-1/2 left-1/2 pointer-events-none text-4xl z-20"
            style={{
              textShadow: '0 2px 10px rgba(0,0,0,0.5)'
            }}
          >
            {reaction.reaction}
          </motion.div>
        ))}
      </AnimatePresence>
    </>
  );
};