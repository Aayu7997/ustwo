import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWebRTC } from '@/hooks/useWebRTC';
import { Button } from '@/components/ui/button';
import { Video, VideoOff, Phone, PhoneOff, Minimize2, Maximize2 } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface VideoCallProps {
  roomId: string;
}

export const VideoCall: React.FC<VideoCallProps> = ({ roomId }) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isPiP, setIsPiP] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  
  const {
    localVideoRef,
    remoteVideoRef,
    isConnected,
    stream,
    remoteStream,
    isInitiator,
    startCall,
    endCall
  } = useWebRTC({ roomId, enabled: isEnabled });

  const handleToggleCall = async () => {
    if (isConnected || stream) {
      endCall();
      setIsEnabled(false);
    } else {
      setIsEnabled(true);
      await startCall();
    }
  };

  const togglePiP = () => {
    setIsPiP(!isPiP);
    setIsMinimized(false);
  };

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
    setIsPiP(false);
  };

  if (!isEnabled && !stream) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mb-4"
      >
        <Button
          onClick={handleToggleCall}
          className="w-full flex items-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700"
        >
          <Video className="w-4 h-4" />
          Start Video Call
        </Button>
      </motion.div>
    );
  }

  const VideoContainer = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => {
    const containerClass = isPiP 
      ? "fixed bottom-4 right-4 w-64 h-48 z-50 shadow-2xl rounded-lg overflow-hidden"
      : isMinimized
        ? "w-full h-32"
        : "w-full h-64 md:h-96";
    
    return (
      <motion.div
        layout
        className={`${containerClass} ${className}`}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
      >
        {children}
      </motion.div>
    );
  };

  return (
    <AnimatePresence>
      <VideoContainer>
        <Card className="h-full bg-black/90 border-pink-200 dark:border-pink-800">
          <div className="relative h-full">
            {/* Remote video (partner) */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
              style={{ display: remoteStream ? 'block' : 'none' }}
            />
            
            {/* Local video (self) - Picture in Picture style */}
            <div className="absolute top-2 right-2 w-20 h-16 md:w-24 md:h-20 rounded-lg overflow-hidden border-2 border-white/50">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ display: stream ? 'block' : 'none' }}
              />
            </div>

            {/* Connection status */}
            {!remoteStream && isEnabled && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <div className="text-center text-white">
                  <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-sm">
                    {isInitiator ? 'Calling your partner...' : 'Connecting...'}
                  </p>
                </div>
              </div>
            )}

            {/* Controls */}
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleToggleCall}
                  className="bg-red-500 hover:bg-red-600 text-white border-red-500"
                >
                  <PhoneOff className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={toggleMinimize}
                  className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                >
                  {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                </Button>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={togglePiP}
                  className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                >
                  {isPiP ? <Maximize2 className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Connection indicator */}
            {isConnected && (
              <div className="absolute top-2 left-2">
                <div className="flex items-center gap-1 bg-green-500 text-white px-2 py-1 rounded-full text-xs">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  Live
                </div>
              </div>
            )}
          </div>
        </Card>
      </VideoContainer>
    </AnimatePresence>
  );
};