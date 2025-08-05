import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWebRTC } from '@/hooks/useWebRTC';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Phone, 
  PhoneOff, 
  Maximize, 
  Minimize, 
  PictureInPicture,
  Settings,
  Volume2,
  VolumeX
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface EnhancedVideoCallProps {
  roomId: string;
}

export const EnhancedVideoCall: React.FC<EnhancedVideoCallProps> = ({ roomId }) => {
  const [enabled, setEnabled] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [isPiP, setIsPiP] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [volume, setVolume] = useState(50);

  const {
    localVideoRef,
    remoteVideoRef,
    isConnected,
    stream,
    remoteStream,
    isInitiator,
    startCall,
    endCall
  } = useWebRTC({ roomId, enabled });

  const handleToggleCall = async () => {
    if (!enabled) {
      try {
        setEnabled(true);
        await startCall();
        toast({
          title: "Video Call Started",
          description: "Waiting for your partner to join...",
        });
      } catch (error) {
        setEnabled(false);
        console.error('Failed to start call:', error);
      }
    } else {
      endCall();
      setEnabled(false);
      setIsPiP(false);
      setIsMinimized(false);
      toast({
        title: "Video Call Ended",
        description: "Call has been disconnected",
      });
    }
  };

  const toggleAudio = () => {
    if (stream) {
      const audioTracks = stream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !audioEnabled;
      });
      setAudioEnabled(!audioEnabled);
      
      toast({
        title: audioEnabled ? "Microphone Off" : "Microphone On",
        description: audioEnabled ? "Your microphone is now muted" : "Your microphone is now active",
      });
    }
  };

  const toggleVideo = () => {
    if (stream) {
      const videoTracks = stream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !videoEnabled;
      });
      setVideoEnabled(!videoEnabled);
      
      toast({
        title: videoEnabled ? "Camera Off" : "Camera On",
        description: videoEnabled ? "Your camera is now off" : "Your camera is now on",
      });
    }
  };

  const togglePiP = async () => {
    if (remoteVideoRef.current && 'requestPictureInPicture' in remoteVideoRef.current) {
      try {
        if (!isPiP) {
          await remoteVideoRef.current.requestPictureInPicture();
          setIsPiP(true);
        } else {
          if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
          }
          setIsPiP(false);
        }
      } catch (error) {
        console.error('PiP error:', error);
        toast({
          title: "Picture-in-Picture Error",
          description: "Could not toggle Picture-in-Picture mode",
          variant: "destructive"
        });
      }
    }
  };

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  if (!enabled) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="w-5 h-5" />
            Video Call
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary/60 rounded-full flex items-center justify-center mx-auto">
            <Video className="w-10 h-10 text-white" />
          </div>
          <p className="text-muted-foreground">
            Start a video call with your partner for a more connected watching experience
          </p>
          <Button onClick={handleToggleCall} size="lg" className="w-full">
            <Phone className="w-4 h-4 mr-2" />
            Start Video Call
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`
        ${isMinimized 
          ? 'fixed bottom-4 right-4 z-50 w-80' 
          : 'w-full max-w-4xl mx-auto'
        }
      `}
    >
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Video className="w-5 h-5" />
              <CardTitle className="text-lg">Video Call</CardTitle>
              <Badge variant={isConnected ? "default" : "secondary"}>
                {isConnected ? "Connected" : "Connecting..."}
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleMinimize}
              >
                {isMinimized ? <Maximize className="w-4 h-4" /> : <Minimize className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={togglePiP}
                disabled={!remoteStream}
              >
                <PictureInPicture className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className={`p-0 ${isMinimized ? 'pb-2' : ''}`}>
          <div className={`grid gap-2 p-4 ${
            isMinimized ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'
          }`}>
            {/* Local Video */}
            <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-2 left-2">
                <Badge variant="outline" className="bg-black/50 text-white border-white/20">
                  You {isInitiator && "(Host)"}
                </Badge>
              </div>
              {!videoEnabled && (
                <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                  <VideoOff className="w-8 h-8 text-gray-400" />
                </div>
              )}
            </div>

            {/* Remote Video */}
            {!isMinimized && (
              <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
                {remoteStream ? (
                  <>
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                      style={{ transform: 'scaleX(-1)' }}
                    />
                    <div className="absolute bottom-2 left-2">
                      <Badge variant="outline" className="bg-black/50 text-white border-white/20">
                        Partner
                      </Badge>
                    </div>
                    <div className="absolute bottom-2 right-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (remoteVideoRef.current) {
                            remoteVideoRef.current.volume = volume / 100;
                          }
                        }}
                        className="text-white hover:bg-white/20"
                      >
                        {volume > 0 ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <div className="text-center">
                      <Video className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Waiting for partner...</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex justify-center gap-2 p-4 bg-muted/30">
            <Button
              variant={audioEnabled ? "default" : "destructive"}
              size="sm"
              onClick={toggleAudio}
            >
              {audioEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </Button>
            
            <Button
              variant={videoEnabled ? "default" : "destructive"}
              size="sm"
              onClick={toggleVideo}
            >
              {videoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
            </Button>
            
            <Button
              variant="destructive"
              size="sm"
              onClick={handleToggleCall}
            >
              <PhoneOff className="w-4 h-4" />
            </Button>

            {!isMinimized && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  toast({
                    title: "Settings",
                    description: "Video call settings coming soon!",
                  });
                }}
              >
                <Settings className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Connection Status */}
          {!isMinimized && (
            <div className="px-4 pb-4">
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="flex justify-between">
                  <span>Connection:</span>
                  <span className={isConnected ? "text-green-600" : "text-yellow-600"}>
                    {isConnected ? "Stable" : "Establishing..."}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Video Quality:</span>
                  <span>720p</span>
                </div>
                <div className="flex justify-between">
                  <span>Audio:</span>
                  <span>{audioEnabled ? "Active" : "Muted"}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};