import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRoomPresence } from '@/hooks/useRoomPresence';
import { Users, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PartnerPresenceProps {
  roomId: string;
}

export const PartnerPresence: React.FC<PartnerPresenceProps> = ({ roomId }) => {
  const { presenceUsers, partnerJoined } = useRoomPresence(roomId);

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-border/50">
        <div className={cn(
          "w-2 h-2 rounded-full transition-colors",
          partnerJoined ? "bg-green-500 animate-pulse" : "bg-muted-foreground/40"
        )} />
        <span className="text-xs font-medium text-muted-foreground">
          {presenceUsers.length} online
        </span>
      </div>
      <AnimatePresence>
        {partnerJoined && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 font-medium"
          >
            <Wifi className="w-3 h-3" />
            Partner connected
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
