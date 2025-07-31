import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRoomPresence } from '@/hooks/useRoomPresence';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Heart, User, Play, Pause, Clock, Loader } from 'lucide-react';

interface PartnerPresenceProps {
  roomId: string;
}

export const PartnerPresence: React.FC<PartnerPresenceProps> = ({ roomId }) => {
  const { presenceUsers, partnerJoined, currentPartner } = useRoomPresence(roomId);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'watching':
        return <Play className="w-3 h-3" />;
      case 'paused':
        return <Pause className="w-3 h-3" />;
      case 'buffering':
        return <Loader className="w-3 h-3 animate-spin" />;
      default:
        return <Clock className="w-3 h-3" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'watching':
        return 'bg-green-500';
      case 'paused':
        return 'bg-yellow-500';
      case 'buffering':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <Card className="p-4 mb-4 border-pink-200 dark:border-pink-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
              <Heart className="w-5 h-5 text-white" />
            </div>
            <AnimatePresence>
              {partnerJoined && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"
                />
              )}
            </AnimatePresence>
          </div>
          
          <div>
            <h3 className="font-semibold text-sm">Room Status</h3>
            <p className="text-xs text-muted-foreground">
              {presenceUsers.length} user{presenceUsers.length !== 1 ? 's' : ''} connected
            </p>
          </div>
        </div>

        <div className="text-right">
          <AnimatePresence mode="wait">
            {partnerJoined ? (
              <motion.div
                key="joined"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-2"
              >
                <Badge variant="outline" className="bg-green-50 dark:bg-green-900 border-green-200 dark:border-green-800">
                  <User className="w-3 h-3 mr-1" />
                  Partner joined
                </Badge>
              </motion.div>
            ) : (
              <motion.div
                key="waiting"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Badge variant="outline" className="bg-orange-50 dark:bg-orange-900 border-orange-200 dark:border-orange-800">
                  <Clock className="w-3 h-3 mr-1" />
                  Waiting for partner
                </Badge>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Partner status */}
      <AnimatePresence>
        {currentPartner && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 pt-3 border-t border-pink-100 dark:border-pink-800"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${getStatusColor(currentPartner.status)}`} />
                <span className="text-sm font-medium">
                  {currentPartner.email}
                </span>
              </div>
              
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {getStatusIcon(currentPartner.status)}
                <span className="capitalize">{currentPartner.status}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Join animation */}
      <AnimatePresence>
        {partnerJoined && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute inset-0 flex items-center justify-center bg-pink-500/20 backdrop-blur-sm rounded-lg"
            onAnimationComplete={() => {
              // Animation completes and element disappears after 2 seconds
              setTimeout(() => {}, 2000);
            }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.2, 1] }}
              className="text-center"
            >
              <div className="w-16 h-16 bg-pink-500 rounded-full flex items-center justify-center mx-auto mb-2">
                <Heart className="w-8 h-8 text-white animate-pulse" />
              </div>
              <p className="text-sm font-semibold text-pink-600 dark:text-pink-400">
                Your partner joined! 💕
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
};