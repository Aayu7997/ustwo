import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Video, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface IncomingCallModalProps {
  isOpen: boolean;
  callerName?: string;
  callType: 'video' | 'voice';
  onAccept: () => void;
  onReject: () => void;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  isOpen,
  callerName = 'Your Partner',
  callType,
  onAccept,
  onReject
}) => {
  const [ringCount, setRingCount] = useState(0);

  // Ring animation effect
  useEffect(() => {
    if (!isOpen) {
      setRingCount(0);
      return;
    }

    const interval = setInterval(() => {
      setRingCount(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100001]"
            onClick={onReject}
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 50 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100002]"
          >
            <div className="bg-gradient-to-br from-card via-card to-primary/10 rounded-3xl p-8 shadow-2xl border border-primary/20 min-w-[320px]">
              {/* Caller Avatar with Ring Animation */}
              <div className="relative flex justify-center mb-6">
                {/* Ring animations */}
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    initial={{ scale: 1, opacity: 0.6 }}
                    animate={{ 
                      scale: [1, 2, 2.5],
                      opacity: [0.6, 0.3, 0]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: i * 0.4,
                      ease: 'easeOut'
                    }}
                    className="absolute inset-0 m-auto w-24 h-24 rounded-full bg-primary/30"
                  />
                ))}
                
                {/* Avatar */}
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="relative w-24 h-24 rounded-full bg-gradient-to-br from-primary to-romantic-pink flex items-center justify-center shadow-lg"
                >
                  <User className="w-12 h-12 text-primary-foreground" />
                </motion.div>
              </div>

              {/* Caller Info */}
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  {callerName}
                </h2>
                <p className="text-muted-foreground flex items-center justify-center gap-2">
                  {callType === 'video' ? (
                    <Video className="w-4 h-4" />
                  ) : (
                    <Phone className="w-4 h-4" />
                  )}
                  Incoming {callType} call...
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-center gap-6">
                {/* Reject Button */}
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    onClick={onReject}
                    size="lg"
                    className={cn(
                      "w-16 h-16 rounded-full",
                      "bg-destructive hover:bg-destructive/90",
                      "shadow-lg shadow-destructive/30"
                    )}
                  >
                    <PhoneOff className="w-7 h-7" />
                  </Button>
                </motion.div>

                {/* Accept Button */}
                <motion.div 
                  whileHover={{ scale: 1.1 }} 
                  whileTap={{ scale: 0.95 }}
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <Button
                    onClick={onAccept}
                    size="lg"
                    className={cn(
                      "w-16 h-16 rounded-full",
                      "bg-green-500 hover:bg-green-600",
                      "shadow-lg shadow-green-500/30"
                    )}
                  >
                    {callType === 'video' ? (
                      <Video className="w-7 h-7" />
                    ) : (
                      <Phone className="w-7 h-7" />
                    )}
                  </Button>
                </motion.div>
              </div>

              {/* Timer indicator */}
              <div className="mt-6 text-center">
                <p className="text-xs text-muted-foreground">
                  {30 - (ringCount % 31)}s remaining
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
