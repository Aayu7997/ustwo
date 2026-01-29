import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Phone, 
  PhoneOff, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff,
  Minimize2,
  Maximize2,
  Signal,
  SignalLow,
  SignalMedium,
  SignalHigh,
  X,
  Move,
  PhoneIncoming
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useRobustCallSignaling, CallStatus } from '@/hooks/useRobustCallSignaling';
import { useStableVideoCall, ConnectionState } from '@/hooks/useStableVideoCall';
import { toast } from '@/hooks/use-toast';

interface RobustVideoCallOverlayProps {
  roomId: string;
  partnerId?: string | null;
  partnerName?: string;
  voiceOnly?: boolean;
}

export const RobustVideoCallOverlay: React.FC<RobustVideoCallOverlayProps> = ({
  roomId,
  partnerId,
  partnerName = 'Partner',
  voiceOnly = false
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  // Call signaling
  const {
    callStatus,
    incomingCall,
    activeCall,
    activeCallId,
    initiateCall,
    acceptCall,
    rejectCall,
    cancelCall,
    endCall,
    markConnected
  } = useRobustCallSignaling({ roomId, partnerId });

  // Determine if we're initiator
  const isInitiator = callStatus === 'calling' || 
    (callStatus === 'connecting' && !incomingCall);

  // WebRTC connection
  const {
    connectionState,
    localStream,
    remoteStream,
    isMuted,
    isCameraOff,
    connectionQuality,
    startCall,
    cleanup,
    toggleMute,
    toggleCamera
  } = useStableVideoCall({
    roomId,
    callId: activeCallId,
    isInitiator,
    voiceOnly,
    onConnected: markConnected
  });

  // Start WebRTC when call is accepted/connecting
  useEffect(() => {
    if ((callStatus === 'connecting') && activeCallId) {
      startCall();
    }
  }, [callStatus, activeCallId, startCall]);

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

  // Cleanup on call end
  useEffect(() => {
    if (callStatus === 'ended' || callStatus === 'idle') {
      cleanup();
    }
  }, [callStatus, cleanup]);

  // Play ringtone for incoming calls
  useEffect(() => {
    if (callStatus === 'ringing' && incomingCall) {
      // Create ringtone audio element
      try {
        ringtoneRef.current = new Audio('data:audio/mp3;base64,//uQxAAAAAANIAUAAA...');
        ringtoneRef.current.loop = true;
        ringtoneRef.current.volume = 0.3;
        ringtoneRef.current.play().catch(() => {});
      } catch {}
    } else {
      // Stop ringtone
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current = null;
      }
    }

    return () => {
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current = null;
      }
    };
  }, [callStatus, incomingCall]);

  // Drag handlers
  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;
      
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - 320, dragStartRef.current.posX + deltaX)),
        y: Math.max(0, Math.min(window.innerHeight - 240, dragStartRef.current.posY + deltaY))
      });
    };

    const handleMouseUp = () => setIsDragging(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Signal strength icon
  const SignalIcon = () => {
    const { level } = connectionQuality;
    if (level <= 1) return <SignalLow className="w-4 h-4 text-red-500" />;
    if (level === 2) return <SignalMedium className="w-4 h-4 text-yellow-500" />;
    if (level === 3) return <SignalHigh className="w-4 h-4 text-green-400" />;
    return <Signal className="w-4 h-4 text-green-500" />;
  };

  // Handle call initiation
  const handleStartCall = () => {
    initiateCall(voiceOnly ? 'audio' : 'video');
  };

  // Handle call end
  const handleEndCall = () => {
    cleanup();
    endCall();
  };

  const isInCall = callStatus === 'connecting' || callStatus === 'connected';
  const showCallButton = callStatus === 'idle' && partnerId;

  // Hidden mode for voice calls
  if (isHidden && isInCall) {
    return ReactDOM.createPortal(
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed bottom-4 right-4 z-[100000]"
      >
        <Button
          onClick={() => setIsHidden(false)}
          className="rounded-full bg-primary/90 backdrop-blur-md shadow-lg"
          size="sm"
        >
          <Phone className="w-4 h-4 mr-2" />
          Show Call
        </Button>
      </motion.div>,
      document.body
    );
  }

  return ReactDOM.createPortal(
    <>
      {/* Incoming Call Modal */}
      <AnimatePresence>
        {callStatus === 'ringing' && incomingCall && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-[100000]"
          >
            <div className="bg-card rounded-2xl p-8 text-center shadow-2xl max-w-sm mx-4">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/20 flex items-center justify-center"
              >
                <PhoneIncoming className="w-10 h-10 text-primary" />
              </motion.div>
              
              <h3 className="text-xl font-semibold mb-2">Incoming Call</h3>
              <p className="text-muted-foreground mb-6">
                {partnerName} is calling you...
              </p>
              
              <div className="flex gap-4 justify-center">
                <Button
                  onClick={rejectCall}
                  variant="destructive"
                  size="lg"
                  className="rounded-full px-6"
                >
                  <PhoneOff className="w-5 h-5 mr-2" />
                  Decline
                </Button>
                <Button
                  onClick={acceptCall}
                  size="lg"
                  className="rounded-full px-6 bg-green-500 hover:bg-green-600"
                >
                  <Phone className="w-5 h-5 mr-2" />
                  Accept
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Call Button (when idle) */}
      <AnimatePresence>
        {showCallButton && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-[100000]"
          >
            <Button
              onClick={handleStartCall}
              className={cn(
                "rounded-full shadow-lg h-14 px-6",
                "bg-gradient-to-r from-primary to-pink-500",
                "hover:shadow-xl hover:scale-105 transition-all"
              )}
              size="lg"
            >
              {voiceOnly ? (
                <Phone className="w-5 h-5 mr-2" />
              ) : (
                <Video className="w-5 h-5 mr-2" />
              )}
              {voiceOnly ? 'Voice Call' : 'Video Call'}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Calling State */}
      <AnimatePresence>
        {callStatus === 'calling' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-[100000]"
          >
            <div className="bg-card rounded-2xl p-8 text-center shadow-2xl">
              <div className="relative mb-6">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-20 h-20 mx-auto rounded-full bg-primary/20 flex items-center justify-center"
                >
                  <Phone className="w-10 h-10 text-primary" />
                </motion.div>
              </div>
              <h3 className="text-xl font-semibold mb-2">Calling {partnerName}...</h3>
              <p className="text-muted-foreground mb-6">Waiting for answer</p>
              <Button onClick={cancelCall} variant="destructive" size="lg" className="rounded-full">
                <PhoneOff className="w-5 h-5 mr-2" />
                Cancel
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Call Overlay */}
      <AnimatePresence>
        {isInCall && (
          <motion.div
            ref={containerRef}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={{ left: position.x, top: position.y }}
            className={cn(
              "fixed z-[100000] rounded-2xl overflow-hidden shadow-2xl",
              "bg-black/90 backdrop-blur-md border border-white/10",
              isMinimized ? "w-48" : "w-80"
            )}
          >
            {/* Header */}
            <div
              onMouseDown={handleDragStart}
              className="flex items-center justify-between px-3 py-2 bg-black/50 cursor-move"
            >
              <div className="flex items-center gap-2">
                <Move className="w-4 h-4 text-white/50" />
                <span className="text-sm text-white/80 font-medium">
                  {connectionState === 'connecting' ? 'Connecting...' : 'In Call'}
                </span>
                {connectionState === 'connected' && <SignalIcon />}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-white/70 hover:text-white"
                  onClick={() => setIsMinimized(!isMinimized)}
                >
                  {isMinimized ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
                </Button>
                {voiceOnly && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-white/70 hover:text-white"
                    onClick={() => setIsHidden(true)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>

            {/* Video Area */}
            {!isMinimized && (
              <div className="relative aspect-video bg-black">
                {/* Remote Video */}
                {remoteStream && !voiceOnly ? (
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                      {voiceOnly ? (
                        <Phone className="w-8 h-8 text-primary" />
                      ) : (
                        <VideoOff className="w-8 h-8 text-white/50" />
                      )}
                    </div>
                  </div>
                )}

                {/* Local Video (PiP) */}
                {localStream && !voiceOnly && !isCameraOff && (
                  <div className="absolute bottom-2 right-2 w-20 h-15 rounded-lg overflow-hidden border border-white/20 shadow-lg">
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                  </div>
                )}

                {/* Connection Status */}
                {connectionState === 'connecting' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center justify-center gap-3 p-3 bg-black/50">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleMute}
                className={cn(
                  "rounded-full h-10 w-10",
                  isMuted ? "bg-destructive text-white" : "bg-white/10 text-white hover:bg-white/20"
                )}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </Button>

              {!voiceOnly && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleCamera}
                  className={cn(
                    "rounded-full h-10 w-10",
                    isCameraOff ? "bg-destructive text-white" : "bg-white/10 text-white hover:bg-white/20"
                  )}
                >
                  {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                </Button>
              )}

              <Button
                variant="destructive"
                size="icon"
                onClick={handleEndCall}
                className="rounded-full h-10 w-10"
              >
                <PhoneOff className="w-5 h-5" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body
  );
};
