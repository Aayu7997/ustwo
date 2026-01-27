import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Phone, PhoneOff, Mic, MicOff, Video, VideoOff, 
  Minimize2, Maximize2, Move, Signal, SignalLow, 
  SignalMedium, SignalHigh, X, Eye, EyeOff
} from 'lucide-react';
import { useProductionVideoCall, CallState } from '@/hooks/useProductionVideoCall';
import { cn } from '@/lib/utils';

interface ProductionVideoCallOverlayProps {
  roomId: string;
  roomCode?: string;
  isActive: boolean;
  voiceOnly?: boolean;
  onClose: () => void;
}

export const ProductionVideoCallOverlay: React.FC<ProductionVideoCallOverlayProps> = ({
  roomId,
  roomCode,
  isActive,
  voiceOnly = false,
  onClose
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const {
    callState,
    localStream,
    remoteStream,
    isMuted,
    isCameraOff,
    connectionQuality,
    startCall,
    endCall,
    toggleMute,
    toggleCamera
  } = useProductionVideoCall({ roomId, roomCode, voiceOnly });

  // Set local video stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Set remote video stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Start call when active
  useEffect(() => {
    if (isActive && callState === 'idle') {
      startCall();
    }
  }, [isActive, callState, startCall]);

  // Handle close
  const handleClose = () => {
    if (callState === 'connected' || callState === 'connecting') {
      endCall();
    }
    onClose();
  };

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = Math.max(0, Math.min(window.innerWidth - 320, e.clientX - dragOffset.current.x));
      const newY = Math.max(0, Math.min(window.innerHeight - 240, e.clientY - dragOffset.current.y));
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Connection quality indicator
  const QualityIndicator = () => {
    const { level, latency } = connectionQuality;
    
    const icons = {
      0: <Signal className="w-4 h-4 text-muted-foreground" />,
      1: <SignalLow className="w-4 h-4 text-destructive" />,
      2: <SignalMedium className="w-4 h-4 text-yellow-500" />,
      3: <SignalHigh className="w-4 h-4 text-primary" />,
      4: <Signal className="w-4 h-4 text-green-500" />
    };

    return (
      <div className="flex items-center gap-1" title={`Latency: ${Math.round(latency)}ms`}>
        {icons[level]}
      </div>
    );
  };

  // Status text
  const getStatusText = (state: CallState): string => {
    switch (state) {
      case 'requesting': return 'Requesting access...';
      case 'connecting': return 'Connecting...';
      case 'connected': return 'Connected';
      case 'failed': return 'Connection failed';
      case 'ended': return 'Call ended';
      default: return 'Ready';
    }
  };

  if (!isActive) return null;

  // Voice-only hidden mode
  if (voiceOnly && isHidden) {
    return createPortal(
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed bottom-4 right-4 z-[100000]"
      >
        <Button
          onClick={() => setIsHidden(false)}
          variant="secondary"
          size="sm"
          className="gap-2 shadow-lg"
        >
          <Eye className="w-4 h-4" />
          Show Call Controls
        </Button>
      </motion.div>,
      document.body
    );
  }

  const overlayContent = (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      style={{ left: position.x, top: position.y }}
      className={cn(
        "fixed z-[100000] rounded-xl overflow-hidden shadow-2xl",
        "bg-background/95 backdrop-blur-xl border border-border",
        isMinimized ? "w-64" : "w-80",
        isDragging && "cursor-grabbing"
      )}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-muted/50 cursor-grab">
        <div className="flex items-center gap-2">
          <Move className="w-4 h-4 text-muted-foreground" />
          <Badge 
            variant={callState === 'connected' ? 'default' : 'secondary'}
            className={cn(
              "text-xs",
              callState === 'connected' && "bg-green-500"
            )}
          >
            {getStatusText(callState)}
          </Badge>
          {callState === 'connected' && <QualityIndicator />}
        </div>
        
        <div className="flex items-center gap-1">
          {voiceOnly && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsHidden(true)}
            >
              <EyeOff className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hover:bg-destructive hover:text-destructive-foreground"
            onClick={handleClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Video Area */}
      <AnimatePresence>
        {!isMinimized && !voiceOnly && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="relative"
          >
            {/* Remote Video (large) */}
            <div className="aspect-video bg-black relative">
              {remoteStream ? (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <Phone className="w-10 h-10 mx-auto mb-2 animate-pulse" />
                    <p className="text-sm">Waiting for partner...</p>
                  </div>
                </div>
              )}
              
              {/* Local Video (PiP) */}
              {localStream && (
                <div className="absolute bottom-2 right-2 w-20 h-16 rounded-lg overflow-hidden border-2 border-primary shadow-lg">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={cn(
                      "w-full h-full object-cover",
                      isCameraOff && "hidden"
                    )}
                  />
                  {isCameraOff && (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <VideoOff className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Voice-only indicator */}
      {!isMinimized && voiceOnly && (
        <div className="p-4 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary/20 flex items-center justify-center mb-2">
            <Phone className="w-8 h-8 text-primary animate-pulse" />
          </div>
          <p className="text-sm text-muted-foreground">Voice call active</p>
        </div>
      )}

      {/* Controls */}
      <div className="p-3 flex items-center justify-center gap-2 bg-muted/30">
        <Button
          variant={isMuted ? "destructive" : "secondary"}
          size="icon"
          className="h-10 w-10 rounded-full"
          onClick={toggleMute}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </Button>
        
        {!voiceOnly && (
          <Button
            variant={isCameraOff ? "destructive" : "secondary"}
            size="icon"
            className="h-10 w-10 rounded-full"
            onClick={toggleCamera}
          >
            {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </Button>
        )}
        
        <Button
          variant="destructive"
          size="icon"
          className="h-10 w-10 rounded-full"
          onClick={handleClose}
        >
          <PhoneOff className="w-5 h-5" />
        </Button>
      </div>
    </motion.div>
  );

  return createPortal(overlayContent, document.body);
};
