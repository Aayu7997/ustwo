import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWebRTC } from '@/hooks/useWebRTC';
import { Button } from '@/components/ui/button';
import { Video, VideoOff, Phone, PhoneOff, Minimize2, Maximize2, Mic, MicOff } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface VideoCallProps {
  roomId: string;
  roomCode?: string;
}

export const VideoCall: React.FC<VideoCallProps> = ({ roomId, roomCode }) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isPiP, setIsPiP] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  
  const {
    localVideoRef,
    remoteVideoRef,
    isConnected,
    stream,
    remoteStream,
    isInitiator,
    startCall,
    endCall,
    peer
  } = useWebRTC({ roomId, roomCode, enabled: isEnabled });

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

  const toggleAudio = async () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
        
        // Sync with remote peer
        if (peer && isConnected) {
          peer.send(JSON.stringify({
            type: 'audio_toggle',
            enabled: audioTrack.enabled
          }));
        }
      }
    }
  };

  const toggleVideo = async () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
        
        // Sync with remote peer
        if (peer && isConnected) {
          peer.send(JSON.stringify({
            type: 'video_toggle',
            enabled: videoTrack.enabled
          }));
        }
      }
    }
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
          className="w-full flex items-center gap-2 bg-gradient-to-r from-love-pink to-love-purple hover:from-love-red hover:to-love-pink transition-all duration-300"
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
          <Card className="h-full bg-black/90 border-love-pink/30 dark:border-love-pink/50">
            <div className="relative h-full">
              {/* Remote video (partner) */}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover rounded-lg"
                style={{ display: remoteStream ? 'block' : 'none' }}
              />
              
              {/* Local video (self) - Picture in Picture style */}
              <div className="absolute top-2 right-2 w-20 h-16 md:w-24 md:h-20 rounded-lg overflow-hidden border-2 border-white/50 shadow-lg">
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
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                  <div className="text-center text-white">
                    <div className="w-8 h-8 border-2 border-love-pink border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    <p className="text-sm">
                      {isInitiator ? 'Calling your partner...' : 'Connecting...'}
                    </p>
                  </div>
                </div>
              )}

              {/* Audio/Video indicators */}
              <div className="absolute top-2 left-2 flex gap-2">
                {!isAudioEnabled && (
                  <div className="bg-red-500 text-white px-2 py-1 rounded-full text-xs flex items-center gap-1">
                    <MicOff className="w-3 h-3" />
                    Muted
                  </div>
                )}
                {!isVideoEnabled && (
                  <div className="bg-red-500 text-white px-2 py-1 rounded-full text-xs flex items-center gap-1">
                    <VideoOff className="w-3 h-3" />
                    Camera Off
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between bg-black/50 backdrop-blur-sm rounded-lg p-2">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleToggleCall}
                    className="bg-red-500 hover:bg-red-600 text-white border-red-500 transition-colors"
                  >
                    <PhoneOff className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={toggleAudio}
                    className={`${isAudioEnabled ? 'bg-white/20 hover:bg-white/30' : 'bg-red-500 hover:bg-red-600'} text-white border-white/30 transition-colors`}
                  >
                    {isAudioEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={toggleVideo}
                    className={`${isVideoEnabled ? 'bg-white/20 hover:bg-white/30' : 'bg-red-500 hover:bg-red-600'} text-white border-white/30 transition-colors`}
                  >
                    {isVideoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={toggleMinimize}
                    className="bg-white/20 hover:bg-white/30 text-white border-white/30 transition-colors"
                  >
                    {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={togglePiP}
                    className="bg-white/20 hover:bg-white/30 text-white border-white/30 transition-colors"
                  >
                    {isPiP ? <Maximize2 className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {/* Connection indicator */}
              {isConnected && (
                <div className="absolute top-2 left-1/2 transform -translate-x-1/2">
                  <div className="flex items-center gap-1 bg-green-500 text-white px-3 py-1 rounded-full text-xs shadow-lg">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    Live Call
                  </div>
                </div>
              )}
            </div>
          </Card>
      </VideoContainer>
    </AnimatePresence>
  );
};