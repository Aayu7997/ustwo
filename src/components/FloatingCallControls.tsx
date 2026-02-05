import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Phone, 
  Video, 
  ChevronUp, 
  ChevronDown,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface FloatingCallControlsProps {
  partnerId?: string | null;
  partnerOnline?: boolean;
  onStartVideoCall: () => void;
  onStartVoiceCall: () => void;
  className?: string;
}

export const FloatingCallControls: React.FC<FloatingCallControlsProps> = ({
  partnerId,
  partnerOnline = false,
  onStartVideoCall,
  onStartVoiceCall,
  className
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleStartCall = (type: 'video' | 'voice') => {
    if (!partnerId) {
      toast({
        title: 'No partner in room',
        description: 'Wait for your partner to join before calling',
        variant: 'destructive'
      });
      return;
    }
    
    if (type === 'video') {
      onStartVideoCall();
    } else {
      onStartVoiceCall();
    }
    setIsExpanded(false);
  };

  return ReactDOM.createPortal(
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className={cn(
        "fixed bottom-6 right-6 z-[99999]",
        className
      )}
    >
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="mb-3 flex flex-col gap-2"
          >
            {/* Video Call Button */}
            <Button
              onClick={() => handleStartCall('video')}
              disabled={!partnerId}
              className={cn(
                "rounded-full shadow-lg gap-2 px-5",
                "bg-gradient-to-r from-primary to-accent",
                "hover:shadow-xl hover:scale-105 transition-all",
                !partnerId && "opacity-50 cursor-not-allowed"
              )}
              size="lg"
            >
              <Video className="w-5 h-5" />
              Video Call
            </Button>

            {/* Voice Call Button */}
            <Button
              onClick={() => handleStartCall('voice')}
              disabled={!partnerId}
              className={cn(
                "rounded-full shadow-lg gap-2 px-5",
                "bg-secondary hover:bg-secondary/90",
                "hover:shadow-xl hover:scale-105 transition-all",
                !partnerId && "opacity-50 cursor-not-allowed"
              )}
              size="lg"
            >
              <Phone className="w-5 h-5" />
              Voice Call
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Toggle Button */}
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "rounded-full shadow-2xl h-14 w-14",
            "bg-gradient-to-br from-primary via-accent to-destructive",
            "hover:shadow-primary/30 hover:shadow-2xl transition-all",
            isExpanded && "bg-muted"
          )}
          size="icon"
        >
          {isExpanded ? (
            <X className="w-6 h-6" />
          ) : (
            <div className="relative">
              <Video className="w-6 h-6" />
              {partnerOnline && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-success rounded-full border-2 border-background animate-pulse" />
              )}
            </div>
          )}
        </Button>
      </motion.div>

      {/* Partner Status Indicator */}
      {!isExpanded && partnerId && (
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            "absolute -top-2 -left-2 px-2 py-0.5 rounded-full text-xs font-medium",
            partnerOnline 
              ? "bg-success text-success-foreground" 
              : "bg-muted text-muted-foreground"
          )}
        >
          {partnerOnline ? 'Online' : 'Offline'}
        </motion.div>
      )}
    </motion.div>,
    document.body
  );
};
