import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePersistentWebRTC } from '@/hooks/usePersistentWebRTC';
import { useVideoPiP } from '@/hooks/useVideoPiP';
import { useVideoQuality } from '@/hooks/useVideoQuality';
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
  Move
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { VIDEO_QUALITY_PRESETS } from '@/utils/videoQuality';

interface VideoCallOverlayProps {
  roomId: string;
  roomCode?: string;
  isActive: boolean;
  onClose: () => void;
}

export const VideoCallOverlay: React.FC<VideoCallOverlayProps> = ({
  roomId,
  roomCode,
  isActive,
  onClose
}) => {
  const { quality } = useVideoQuality();
  const { mode, position, customPosition, isDragging, toggleMode, startDrag, endDrag, updateDragPosition } = useVideoPiP();
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const dragRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const {
    localVideoRef,
    remoteVideoRef,
    connectionState,
    isConnected,
    stream,
    remoteStream,
    connectionQuality,
    endCall
  } = usePersistentWebRTC({ 
    roomId, 
    roomCode, 
    enabled: isActive,
    quality
  });

  const handleEndCall = () => {
    endCall();
    onClose();
  };

  const toggleAudio = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  // Drag handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const newX = e.clientX - dragStartRef.current.x;
      const newY = e.clientY - dragStartRef.current.y;
      
      // Keep within viewport bounds
      const maxX = window.innerWidth - (mode === 'pip' ? 264 : mode === 'full' ? 384 : 240);
      const maxY = window.innerHeight - (mode === 'pip' ? 192 : mode === 'full' ? 288 : 48);
      
      const boundedX = Math.max(0, Math.min(newX, maxX));
      const boundedY = Math.max(0, Math.min(newY, maxY));
      
      updateDragPosition(boundedX, boundedY);
    };

    const handleMouseUp = () => {
      if (isDragging) {
        endDrag();
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, mode, endDrag, updateDragPosition]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    
    const rect = dragRef.current.getBoundingClientRect();
    dragStartRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    
    startDrag();
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

  const isLoading = connectionState === 'connecting' || connectionState === 'reconnecting';
  const isFailed = connectionState === 'failed' || connectionState === 'disconnected';
  const isMinimized = mode === 'minimized';

  return (
    <AnimatePresence>
      <motion.div
        ref={dragRef}
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
              onMouseDown={handleMouseDown}
            >
              <div className="flex items-center gap-2">
                <Move className="w-3 h-3 text-white/50" />
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  isConnected ? "bg-video-active animate-pulse" : "bg-red-500"
                )} />
                <span className="text-white text-sm font-medium">
                  {isConnected ? 'Video Call Active' : isLoading ? 'Connecting...' : 'Disconnected'}
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
                onMouseDown={handleMouseDown}
              >
                <Move className="w-4 h-4 text-white/30" />
              </div>

              {/* Remote video (partner) */}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className={cn(
                  "w-full h-full object-cover",
                  !remoteStream && "hidden"
                )}
              />

              {/* Local video (self) - Small overlay */}
              <div className="absolute top-2 right-2 w-16 h-12 rounded overflow-hidden border-2 border-white/50">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={cn(
                    "w-full h-full object-cover",
                    !stream && "hidden"
                  )}
                />
              </div>

              {/* Loading/Connection Status */}
              {(isLoading || isFailed) && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                  <div className="text-center text-white space-y-2">
                    {isLoading && (
                      <>
                        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                        <p className="text-sm">
                          {connectionState === 'connecting' ? 'Connecting...' : 'Reconnecting...'}
                        </p>
                      </>
                    )}
                    {isFailed && (
                      <>
                        <PhoneOff className="w-8 h-8 mx-auto text-red-500" />
                        <p className="text-sm">Connection Lost</p>
                        <Button
                          size="sm"
                          onClick={handleEndCall}
                          variant="outline"
                          className="text-xs"
                        >
                          Close
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Status Badges */}
              {isConnected && (
                <div className="absolute top-2 left-2 flex flex-col gap-1">
                  <Badge variant="default" className="bg-video-active text-white text-xs">
                    <div className="w-1.5 h-1.5 bg-white rounded-full mr-1 animate-pulse" />
                    Live
                  </Badge>
                  {connectionQuality && (
                    <Badge 
                      variant="secondary" 
                      className={cn(
                        "text-xs",
                        connectionQuality === 'excellent' && "bg-green-500/80 text-white",
                        connectionQuality === 'good' && "bg-yellow-500/80 text-white",
                        connectionQuality === 'poor' && "bg-red-500/80 text-white"
                      )}
                    >
                      {VIDEO_QUALITY_PRESETS[quality].label}
                    </Badge>
                  )}
                  {!isAudioEnabled && (
                    <Badge variant="destructive" className="text-xs">
                      <MicOff className="w-2.5 h-2.5 mr-1" />
                      Muted
                    </Badge>
                  )}
                  {!isVideoEnabled && (
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
                      onClick={toggleAudio}
                      className={cn(
                        "h-8 w-8 rounded-full",
                        isAudioEnabled 
                          ? "bg-video-active hover:bg-green-600 text-white" 
                          : "bg-video-inactive hover:bg-red-600 text-white"
                      )}
                    >
                      {isAudioEnabled ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={toggleVideo}
                      className={cn(
                        "h-8 w-8 rounded-full",
                        isVideoEnabled 
                          ? "bg-video-active hover:bg-green-600 text-white" 
                          : "bg-video-inactive hover:bg-red-600 text-white"
                      )}
                    >
                      {isVideoEnabled ? <Video className="w-3 h-3" /> : <VideoOff className="w-3 h-3" />}
                    </Button>
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
