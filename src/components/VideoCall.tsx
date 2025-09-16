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
      try {
        setIsEnabled(true);
        await startCall();
      } catch (error) {
        console.error('Failed to start call:', error);
        setIsEnabled(false);
      }
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
        <div className="space-y-3 text-center">
          <div className="p-4 bg-gradient-to-r from-love-pink/10 to-love-purple/10 rounded-lg border border-love-pink/20">
            <Video className="w-8 h-8 mx-auto mb-2 text-love-pink" />
            <h3 className="font-semibold text-love-pink mb-1">Video Call Ready</h3>
            <p className="text-sm text-muted-foreground">
              Connect face-to-face while watching together
            </p>
          </div>
          
          <Button
            onClick={handleToggleCall}
            disabled={isEnabled && !stream}
            className="w-full flex items-center gap-2 bg-gradient-to-r from-love-pink to-love-purple hover:from-love-pink/90 hover:to-love-purple/90 text-white transition-all duration-300 disabled:opacity-50 shadow-lg"
            size="lg"
          >
            {isEnabled && !stream ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Getting Camera Ready...
              </>
            ) : (
              <>
                <Video className="w-5 h-5" />
                Start Video Call
              </>
            )}
          </Button>
          
          <p className="text-xs text-muted-foreground">
            📹 Allow camera & microphone access when prompted
          </p>
        </div>
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
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-video-bg/95 to-black/90 backdrop-blur-sm">
                  <div className="text-center text-white space-y-3">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="w-12 h-12 border-3 border-love-pink border-t-transparent rounded-full mx-auto"
                    />
                    <div>
                      <p className="text-lg font-medium">
                        {isInitiator ? '📞 Calling your partner...' : '🔗 Connecting...'}
                      </p>
                      <p className="text-sm text-white/70 mt-1">
                        {isInitiator ? 'Waiting for them to answer' : 'Establishing connection'}
                      </p>
                    </div>
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
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between bg-gradient-to-r from-video-control/90 to-video-bg/90 backdrop-blur-md rounded-lg p-3 border border-white/10">
                <div className="flex gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleToggleCall}
                    className="w-10 h-10 bg-video-inactive hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-all duration-200 shadow-lg"
                  >
                    <PhoneOff className="w-4 h-4" />
                  </motion.button>
                </div>

                <div className="flex gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={toggleAudio}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg ${
                      isAudioEnabled 
                        ? 'bg-video-active hover:bg-green-600 text-white' 
                        : 'bg-video-inactive hover:bg-red-600 text-white'
                    }`}
                  >
                    {isAudioEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  </motion.button>
                  
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={toggleVideo}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg ${
                      isVideoEnabled 
                        ? 'bg-video-active hover:bg-green-600 text-white' 
                        : 'bg-video-inactive hover:bg-red-600 text-white'
                    }`}
                  >
                    {isVideoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                  </motion.button>
                  
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={toggleMinimize}
                    className="w-10 h-10 bg-white/20 hover:bg-white/30 text-white rounded-full flex items-center justify-center transition-all duration-200 shadow-lg"
                  >
                    {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                  </motion.button>
                  
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={togglePiP}
                    className="w-10 h-10 bg-white/20 hover:bg-white/30 text-white rounded-full flex items-center justify-center transition-all duration-200 shadow-lg"
                  >
                    {isPiP ? <Maximize2 className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                  </motion.button>
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