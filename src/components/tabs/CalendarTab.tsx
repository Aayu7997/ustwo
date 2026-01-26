import React from 'react';
import { motion } from 'framer-motion';
import { EnhancedSharedCalendar } from '@/components/EnhancedSharedCalendar';

interface CalendarTabProps {
  roomId: string;
  partnerId?: string;
}

export const CalendarTab: React.FC<CalendarTabProps> = ({ roomId }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Shared Calendar</h2>
        <p className="text-muted-foreground">
          Plan movie nights and special watch sessions together
        </p>
      </div>
      
      <EnhancedSharedCalendar roomId={roomId} />
    </motion.div>
  );
};
