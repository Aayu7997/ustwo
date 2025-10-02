import React from 'react';
import { motion } from 'framer-motion';
import { LoveMeter } from '@/components/LoveMeter';

interface LoveMeterTabProps {
  partnerId?: string;
}

export const LoveMeterTab: React.FC<LoveMeterTabProps> = ({ partnerId }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Love Meter</h2>
        <p className="text-muted-foreground">
          Track your watch time, sessions, and special moments together
        </p>
      </div>
      
      <LoveMeter partnerId={partnerId} />
    </motion.div>
  );
};
