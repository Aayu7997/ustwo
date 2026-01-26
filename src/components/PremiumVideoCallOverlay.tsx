import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useRobustWebRTC } from '@/hooks/useRobustWebRTC';
import { useVideoPiP } from '@/hooks/useVideoPiP';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  PhoneOff, 
  Maximize2, 
  Minimize2,
  X,
  Move,
  Phone,
  Heart,
  Sparkles,
  Volume2,
  VolumeX,
  ScreenShare,
  ScreenShareOff,
  Settings,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PremiumVideoCallOverlayProps {
  roomId: string;
  roomCode?: string;
  isActive: boolean;
  voiceOnly?: boolean;
  onClose: () => void;
}

export const PremiumVideoCallOverlay: React.FC<PremiumVideoCallOverlayProps> = ({
  roomId,
  roomCode,
  isActive,
  voiceOnly = false,
  onClose
}) => {
  const { 
    mode, 
    position, 
    customPosition, 
    isDragging, 
    toggleMode, 
    startDrag, 
    endDrag, 
    updateDragPosition 
  } = useVideoPiP();

  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(!voiceOnly);
  const [isHidden, setIsHidden] = useState(false);
  const [showEffects, setShowEffects] = useState(false);

  const {
    localVideoRef,
    remoteVideoRef,
    isConnected,
    isLoading,
    isFailed,
    connectionQuality,
    stream,
    remoteStream,
    startCall,
    endCall,
    toggleAudio,
    toggleVideo
  } = useRobustWebRTC({
    roomId, 
    roomCode, 
    enabled: isActive,
    voiceOnly
  });

  // Start call when overlay becomes active
  useEffect(() => {
    if (isActive && !stream) {
      startCall().catch(console.error);
    }
  }, [isActive, stream, startCall]);

  // Drag handlers
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const width = mode === 'pip' ? 320 : mode === 'full' ? 480 : 280;
      const height = mode === 'pip' ? 240 : mode === 'full' ? 360 : 56;
      
      const newX = Math.max(0, Math.min(e.clientX - width / 2, window.innerWidth - width));
      const newY = Math.max(0, Math.min(e.clientY - 20, window.innerHeight - height));
      
      updateDragPosition(newX, newY);
    };

    const handleMouseUp = () => endDrag();

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, mode, endDrag, updateDragPosition]);

  const handleEndCall = () => {
    endCall();
    onClose();
  };

  const handleToggleAudio = () => {
    const enabled = toggleAudio();
    setIsAudioEnabled(enabled);
  };

  const handleToggleVideo = () => {
    if (!voiceOnly) {
      const enabled = toggleVideo();
      setIsVideoEnabled(enabled);
    }
  };

  if (!isActive) return null;

  // Hidden mode for voice-only
  if (isHidden && voiceOnly) {
    return ReactDOM.createPortal(
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="fixed bottom-4 right-4 z-[100000]"
      >
        <Button
          size="sm"
          onClick={() => setIsHidden(false)}
          className="gap-2 bg-gradient-romantic shadow-lg hover:shadow-xl transition-shadow"
        >
          <Phone className="w-4 h-4" />
          <span className="animate-pulse">●</span>
          Voice Call Active
        </Button>
      </motion.div>,
      document.body
    );
  }

  const getPositionStyles = () => {
    if (position === 'custom') {
      return { left: `${customPosition.x}px`, top: `${customPosition.y}px` };
    }
    
    switch (position) {
      case 'top-right': return { top: '1rem', right: '1rem' };
      case 'top-left': return { top: '1rem', left: '1rem' };
      case 'bottom-right': return { bottom: '1rem', right: '1rem' };
      case 'bottom-left': return { bottom: '1rem', left: '1rem' };
      default: return { bottom: '1rem', right: '1rem' };
    }
  };

  const getSizeClasses = () => {
    switch (mode) {
      case 'pip': return 'w-80 h-60';
      case 'full': return 'w-[480px] h-[360px]';
      case 'minimized': return 'w-72 h-14';
      default: return 'w-80 h-60';
    }
  };

  const getQualityInfo = () => {
    switch (connectionQuality) {
      case 'excellent': return { color: 'bg-green-500', label: 'Excellent', bars: 4 };
      case 'good': return { color: 'bg-yellow-500', label: 'Good', bars: 3 };
      case 'poor': return { color: 'bg-red-500', label: 'Poor', bars: 1 };
      default: return { color: 'bg-gray-500', label: 'Connecting', bars: 0 };
    }
  };

  const qualityInfo = getQualityInfo();
  const isMinimized = mode === 'minimized';

  return ReactDOM.createPortal(
    <TooltipProvider>
      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          style={getPositionStyles()}
          className={cn(
            'fixed z-[100000]',
            getSizeClasses(),
            isDragging && 'cursor-grabbing'
          )}
        >
          <Card className={cn(
            "h-full overflow-hidden select-none shadow-2xl",
            "bg-gradient-to-br from-gray-900/95 to-black/95 backdrop-blur-xl",
            "border border-white/10",
            isConnected && "ring-2 ring-primary/30"
          )}>
            {isMinimized ? (
              // Minimized Bar
              <div 
                className="h-full flex items-center justify-between px-4 cursor-grab active:cursor-grabbing"
                onMouseDown={startDrag}
              >
                <div className="flex items-center gap-3">
                  <Move className="w-4 h-4 text-white/40" />
                  
                  {/* Connection Quality Bars */}
                  <div className="flex items-end gap-0.5 h-4">
                    {[1, 2, 3, 4].map((bar) => (
                      <div
                        key={bar}
                        className={cn(
                          "w-1 rounded-full transition-all",
                          bar <= qualityInfo.bars ? qualityInfo.color : 'bg-white/20',
                          bar === 1 ? 'h-1' : bar === 2 ? 'h-2' : bar === 3 ? 'h-3' : 'h-4'
                        )}
                      />
                    ))}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {voiceOnly ? <Phone className="w-4 h-4 text-primary" /> : <Video className="w-4 h-4 text-primary" />}
                    <span className="text-white text-sm font-medium">
                      {isConnected ? (voiceOnly ? 'Voice Call' : 'Video Call') : isLoading ? 'Connecting...' : 'Disconnected'}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleToggleAudio}
                        className={cn(
                          "h-8 w-8 rounded-full",
                          isAudioEnabled ? "text-white hover:bg-white/20" : "text-red-400 hover:bg-red-500/20"
                        )}
                      >
                        {isAudioEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{isAudioEnabled ? 'Mute' : 'Unmute'}</TooltipContent>
                  </Tooltip>
                  
                  {voiceOnly && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setIsHidden(true)}
                          className="h-8 w-8 text-white hover:bg-white/20 rounded-full"
                        >
                          <Minimize2 className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Hide</TooltipContent>
                    </Tooltip>
                  )}
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleMode}
                        className="h-8 w-8 text-white hover:bg-white/20 rounded-full"
                      >
                        <Maximize2 className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Expand</TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleEndCall}
                        className="h-8 w-8 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-full"
                      >
                        <PhoneOff className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>End Call</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            ) : (
              // Full/PiP View
              <div className="relative h-full">
                {/* Drag Handle */}
                <div 
                  className="absolute top-0 left-0 right-0 h-8 cursor-grab active:cursor-grabbing flex items-center justify-center z-20 bg-gradient-to-b from-black/60 to-transparent"
                  onMouseDown={startDrag}
                >
                  <div className="flex items-center gap-1">
                    <div className="w-8 h-1 bg-white/30 rounded-full" />
                  </div>
                </div>

                {/* Remote Video (Partner) */}
                {!voiceOnly && (
                  <div className="w-full h-full bg-gradient-to-br from-gray-900 to-black">
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      className={cn(
                        "w-full h-full object-cover",
                        !remoteStream && "hidden"
                      )}
                    />
                    
                    {!remoteStream && !isLoading && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center space-y-4">
                          <motion.div
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="w-20 h-20 mx-auto rounded-full bg-gradient-romantic flex items-center justify-center"
                          >
                            <Heart className="w-10 h-10 text-white" />
                          </motion.div>
                          <p className="text-white/70 text-sm">Waiting for your partner...</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Voice Only Mode */}
                {voiceOnly && (
                  <div className="w-full h-full bg-gradient-to-br from-primary/20 via-purple-900/30 to-pink-900/20 flex items-center justify-center">
                    <div className="text-center space-y-4">
                      <motion.div
                        animate={{ 
                          scale: isConnected ? [1, 1.15, 1] : 1,
                          rotate: isConnected ? [0, 5, -5, 0] : 0
                        }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="relative"
                      >
                        <div className="w-24 h-24 rounded-full bg-gradient-romantic flex items-center justify-center shadow-glow">
                          <Phone className="w-12 h-12 text-white" />
                        </div>
                        {isConnected && (
                          <motion.div
                            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="absolute inset-0 rounded-full bg-primary/30"
                          />
                        )}
                      </motion.div>
                      <div className="space-y-1">
                        <p className="text-white font-medium">
                          {isConnected ? 'Connected' : isLoading ? 'Connecting...' : 'Waiting...'}
                        </p>
                        {isConnected && (
                          <p className="text-white/50 text-sm flex items-center justify-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            Voice call active
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Local Video (Self) - PiP Corner */}
                {!voiceOnly && stream && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute top-10 right-3 w-20 h-16 rounded-lg overflow-hidden border-2 border-white/30 shadow-lg bg-gray-900"
                  >
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    {!isVideoEnabled && (
                      <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                        <VideoOff className="w-6 h-6 text-white/50" />
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Loading Overlay */}
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-10">
                    <div className="text-center space-y-3">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                        className="w-12 h-12 border-3 border-primary border-t-transparent rounded-full mx-auto"
                      />
                      <p className="text-white/70 text-sm">Connecting...</p>
                    </div>
                  </div>
                )}

                {/* Failed State */}
                {isFailed && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-10">
                    <div className="text-center space-y-3">
                      <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
                        <PhoneOff className="w-6 h-6 text-red-400" />
                      </div>
                      <p className="text-white/70 text-sm">Connection failed</p>
                      <Button size="sm" onClick={() => startCall()} className="gap-2">
                        <RefreshCw className="w-4 h-4" />
                        Retry
                      </Button>
                    </div>
                  </div>
                )}

                {/* Status Badges */}
                {isConnected && (
                  <div className="absolute top-10 left-3 flex flex-col gap-1 z-10">
                    <Badge className={cn("text-xs", qualityInfo.color === 'bg-green-500' ? 'bg-green-500/90' : qualityInfo.color === 'bg-yellow-500' ? 'bg-yellow-500/90' : 'bg-red-500/90')}>
                      <div className="flex items-end gap-0.5 mr-1.5 h-3">
                        {[1, 2, 3, 4].map((bar) => (
                          <div
                            key={bar}
                            className={cn(
                              "w-0.5 bg-white/90 rounded-full",
                              bar <= qualityInfo.bars ? 'opacity-100' : 'opacity-30',
                              bar === 1 ? 'h-1' : bar === 2 ? 'h-1.5' : bar === 3 ? 'h-2' : 'h-3'
                            )}
                          />
                        ))}
                      </div>
                      {qualityInfo.label}
                    </Badge>
                    
                    {!isAudioEnabled && (
                      <Badge variant="destructive" className="text-xs">
                        <MicOff className="w-3 h-3 mr-1" />
                        Muted
                      </Badge>
                    )}
                  </div>
                )}

                {/* Controls */}
                <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 to-transparent z-10">
                  <div className="flex items-center justify-between">
                    {/* Left Controls */}
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleToggleAudio}
                            className={cn(
                              "h-10 w-10 rounded-full flex items-center justify-center transition-colors",
                              isAudioEnabled 
                                ? "bg-white/20 hover:bg-white/30 text-white" 
                                : "bg-red-500/80 hover:bg-red-500 text-white"
                            )}
                          >
                            {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                          </motion.button>
                        </TooltipTrigger>
                        <TooltipContent>{isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}</TooltipContent>
                      </Tooltip>
                      
                      {!voiceOnly && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={handleToggleVideo}
                              className={cn(
                                "h-10 w-10 rounded-full flex items-center justify-center transition-colors",
                                isVideoEnabled 
                                  ? "bg-white/20 hover:bg-white/30 text-white" 
                                  : "bg-red-500/80 hover:bg-red-500 text-white"
                              )}
                            >
                              {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                            </motion.button>
                          </TooltipTrigger>
                          <TooltipContent>{isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}</TooltipContent>
                        </Tooltip>
                      )}
                    </div>

                    {/* Right Controls */}
                    <div className="flex items-center gap-2">
                      {voiceOnly && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setIsHidden(true)}
                              className="h-10 w-10 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center"
                            >
                              <Minimize2 className="w-5 h-5" />
                            </motion.button>
                          </TooltipTrigger>
                          <TooltipContent>Hide overlay</TooltipContent>
                        </Tooltip>
                      )}
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={toggleMode}
                            className="h-10 w-10 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center"
                          >
                            {mode === 'pip' ? <Maximize2 className="w-5 h-5" /> : <Minimize2 className="w-5 h-5" />}
                          </motion.button>
                        </TooltipTrigger>
                        <TooltipContent>{mode === 'pip' ? 'Expand' : 'Minimize'}</TooltipContent>
                      </Tooltip>
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleEndCall}
                            className="h-10 w-10 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg"
                          >
                            <PhoneOff className="w-5 h-5" />
                          </motion.button>
                        </TooltipTrigger>
                        <TooltipContent>End call</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </motion.div>
      </AnimatePresence>
    </TooltipProvider>,
    document.body
  );
};
