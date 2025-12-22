import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRobustWebRTC } from '@/hooks/useRobustWebRTC';
import { useVideoPiP } from '@/hooks/useVideoPiP';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface EnhancedVideoCallOverlayProps {
  roomId: string;
  roomCode?: string;
  isActive: boolean;
  voiceOnly?: boolean;
  onClose: () => void;
}

export const EnhancedVideoCallOverlay: React.FC<EnhancedVideoCallOverlayProps> = ({
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
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);

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
  React.useEffect(() => {
    if (isActive && !stream) {
      console.log('[VideoCallOverlay] Starting call...');
      startCall().catch(err => {
        console.error('[VideoCallOverlay] Failed to start call:', err);
      });
    }
  }, [isActive, stream, startCall]);

  // Drag handlers
  React.useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - (mode === 'pip' ? 132 : mode === 'full' ? 192 : 120);
      const newY = e.clientY - (mode === 'pip' ? 96 : mode === 'full' ? 144 : 24);
      
      const maxX = window.innerWidth - (mode === 'pip' ? 264 : mode === 'full' ? 384 : 240);
      const maxY = window.innerHeight - (mode === 'pip' ? 192 : mode === 'full' ? 288 : 48);
      
      const boundedX = Math.max(0, Math.min(newX, maxX));
      const boundedY = Math.max(0, Math.min(newY, maxY));
      
      updateDragPosition(boundedX, boundedY);
    };

    const handleMouseUp = () => {
      endDrag();
    };

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

  const getPositionStyles = () => {
    if (position === 'custom') {
      return {
        left: `${customPosition.x}px`,
        top: `${customPosition.y}px`
      };
    }
    
    if (mode === 'minimized') {
      return { bottom: '1rem', right: '1rem' };
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
      case 'pip': return 'w-64 h-48';
      case 'full': return 'w-96 h-72';
      case 'minimized': return 'w-60 h-12';
      default: return 'w-64 h-48';
    }
  };

  const getQualityColor = () => {
    switch (connectionQuality) {
      case 'excellent': return 'bg-green-500';
      case 'good': return 'bg-yellow-500';
      case 'poor': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const isMinimized = mode === 'minimized';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        style={getPositionStyles()}
        className={cn(
          'fixed z-50',
          getSizeClasses(),
          isDragging && 'cursor-grabbing'
        )}
      >
        <Card className="h-full bg-black/95 border-primary/30 overflow-hidden backdrop-blur-sm select-none">
          {isMinimized ? (
            // Minimized bar view
            <div 
              className="h-full flex items-center justify-between px-4 cursor-grab active:cursor-grabbing"
              onMouseDown={startDrag}
            >
              <div className="flex items-center gap-2">
                <Move className="w-3 h-3 text-white/50" />
                <div className={cn("w-2 h-2 rounded-full animate-pulse", getQualityColor())} />
                <span className="text-white text-sm font-medium flex items-center gap-2">
                  {voiceOnly ? <Phone className="w-3 h-3" /> : <Video className="w-3 h-3" />}
                  {isConnected ? (voiceOnly ? 'Voice Call Active' : 'Video Call Active') : isLoading ? 'Connecting...' : 'Disconnected'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleMode}
                  className="h-8 w-8 text-white hover:bg-white/20"
                >
                  <Maximize2 className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleEndCall}
                  className="h-8 w-8 text-white hover:bg-red-500/20"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ) : (
            // Full/PiP view
            <div className="relative h-full">
              {/* Drag handle */}
              <div 
                className="absolute top-0 left-0 right-0 h-8 cursor-grab active:cursor-grabbing flex items-center justify-center z-10"
                onMouseDown={startDrag}
              >
                <Move className="w-4 h-4 text-white/30" />
              </div>

              {/* Remote video (partner) */}
              {!voiceOnly && (
                <div className="w-full h-full bg-gray-900">
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
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                      <div className="text-center text-white space-y-2">
                        <Video className="w-12 h-12 mx-auto opacity-50" />
                        <p className="text-sm opacity-75">Waiting for partner...</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Voice-only mode */}
              {voiceOnly && (
                <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <div className="text-center text-white space-y-3">
                    <motion.div
                      animate={{ 
                        scale: isConnected ? [1, 1.2, 1] : 1,
                        opacity: isConnected ? [0.5, 1, 0.5] : 0.3
                      }}
                      transition={{ 
                        duration: 2,
                        repeat: isConnected ? Infinity : 0
                      }}
                    >
                      <Phone className="w-16 h-16 mx-auto" />
                    </motion.div>
                    <p className="text-sm opacity-75">
                      {isConnected ? 'Voice call active' : isLoading ? 'Connecting...' : 'Waiting for partner...'}
                    </p>
                  </div>
                </div>
              )}

              {/* Local video (self) - Small overlay */}
              {!voiceOnly && stream && (
                <div className="absolute top-2 right-2 w-16 h-12 rounded overflow-hidden border-2 border-white/50 bg-gray-900">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Loading/Connection Status */}
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                  <div className="text-center text-white space-y-2">
                    <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-sm">Connecting...</p>
                  </div>
                </div>
              )}

              {/* Status Badges */}
              {isConnected && (
                <div className="absolute top-2 left-2 flex flex-col gap-1">
                  <Badge variant="default" className="bg-video-active text-white text-xs">
                    <div className={cn("w-1.5 h-1.5 rounded-full mr-1 animate-pulse", getQualityColor())} />
                    {connectionQuality}
                  </Badge>
                  {!isAudioEnabled && (
                    <Badge variant="destructive" className="text-xs">
                      <MicOff className="w-2.5 h-2.5 mr-1" />
                      Muted
                    </Badge>
                  )}
                  {!voiceOnly && !isVideoEnabled && (
                    <Badge variant="destructive" className="text-xs">
                      <VideoOff className="w-2.5 h-2.5 mr-1" />
                      Camera Off
                    </Badge>
                  )}
                </div>
              )}

              {/* Controls */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleToggleAudio}
                      className={cn(
                        "h-8 w-8 rounded-full",
                        isAudioEnabled 
                          ? "bg-video-active hover:bg-green-600 text-white" 
                          : "bg-video-inactive hover:bg-red-600 text-white"
                      )}
                    >
                      {isAudioEnabled ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
                    </Button>
                    
                    {!voiceOnly && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleToggleVideo}
                        className={cn(
                          "h-8 w-8 rounded-full",
                          isVideoEnabled 
                            ? "bg-video-active hover:bg-green-600 text-white" 
                            : "bg-video-inactive hover:bg-red-600 text-white"
                        )}
                      >
                        {isVideoEnabled ? <Video className="w-3 h-3" /> : <VideoOff className="w-3 h-3" />}
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={toggleMode}
                      className="h-8 w-8 text-white hover:bg-white/20 rounded-full"
                    >
                      {mode === 'pip' ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleEndCall}
                      className="h-8 w-8 bg-video-inactive hover:bg-red-600 text-white rounded-full"
                    >
                      <PhoneOff className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>
      </motion.div>
    </AnimatePresence>
  );
};