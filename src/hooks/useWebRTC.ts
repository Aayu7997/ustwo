
import { useEffect, useRef, useState, useCallback } from 'react';
import SimplePeer from 'simple-peer';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/components/ui/use-toast';

interface WebRTCProps {
  roomId: string;
  enabled: boolean;
}

export const useWebRTC = ({ roomId, enabled }: WebRTCProps) => {
  const { user } = useAuth();
  const [peer, setPeer] = useState<SimplePeer.Instance | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isInitiator, setIsInitiator] = useState(false);
  const channelRef = useRef<any>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const initializeMedia = useCallback(async () => {
    try {
      console.log('Initializing media stream...');
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          facingMode: 'user',
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      });
      
      console.log('Media stream obtained:', mediaStream.getTracks().length, 'tracks');
      setStream(mediaStream);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = mediaStream;
        localVideoRef.current.muted = true;
      }
      
      return mediaStream;
    } catch (error) {
      console.error('Failed to get media:', error);
      let errorMessage = "Failed to access camera/microphone";
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = "Camera/microphone access denied. Please allow permissions and refresh.";
        } else if (error.name === 'NotFoundError') {
          errorMessage = "No camera/microphone found.";
        } else if (error.name === 'NotReadableError') {
          errorMessage = "Camera/microphone is already in use.";
        }
      }
      
      toast({
        title: "Media Access Error",
        description: errorMessage,
        variant: "destructive"
      });
      throw error;
    }
  }, []);

  const createPeer = useCallback((initiator: boolean, stream: MediaStream) => {
    console.log('Creating peer, initiator:', initiator);
    
    const newPeer = new SimplePeer({
      initiator,
      trickle: false,
      stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' },
          { 
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ],
        iceCandidatePoolSize: 10
      }
    });

    newPeer.on('signal', (data) => {
      console.log('Sending signal:', data.type, 'from user:', user?.id);
      channelRef.current?.send({
        type: 'broadcast',
        event: 'webrtc_signal',
        payload: {
          signal: data,
          from: user?.id,
          timestamp: Date.now()
        }
      });
    });

    newPeer.on('stream', (remoteStream) => {
      console.log('Received remote stream with', remoteStream.getTracks().length, 'tracks');
      setRemoteStream(remoteStream);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    });

    newPeer.on('connect', () => {
      console.log('Peer connection established successfully');
      setIsConnected(true);
      toast({
        title: "Video Call Connected! 💕",
        description: "You're now connected for video chat!"
      });
    });

    newPeer.on('close', () => {
      console.log('Peer connection closed');
      setIsConnected(false);
      setRemoteStream(null);
    });

    newPeer.on('error', (error) => {
      console.error('WebRTC peer error:', error);
      toast({
        title: "Connection Issue",
        description: "There was a problem with the video connection. Please try again.",
        variant: "destructive"
      });
    });

    return newPeer;
  }, [user?.id]);

  const startCall = useCallback(async () => {
    if (!enabled || !user) return;

    try {
      console.log('Starting call for user:', user.id);
      const mediaStream = await initializeMedia();
      const newPeer = createPeer(true, mediaStream);
      setPeer(newPeer);
      setIsInitiator(true);
      
      toast({
        title: "Starting video call...",
        description: "Waiting for your partner to join"
      });
    } catch (error) {
      console.error('Failed to start call:', error);
    }
  }, [enabled, user, initializeMedia, createPeer]);

  const answerCall = useCallback(async (signal: any) => {
    if (!enabled || !user) return;

    try {
      console.log('Answering call from signal:', signal.type);
      const mediaStream = await initializeMedia();
      const newPeer = createPeer(false, mediaStream);
      setPeer(newPeer);
      setIsInitiator(false);
      
      // Answer the call
      newPeer.signal(signal);
      
      toast({
        title: "Joining video call...",
        description: "Connecting to your partner"
      });
    } catch (error) {
      console.error('Failed to answer call:', error);
    }
  }, [enabled, user, initializeMedia, createPeer]);

  const endCall = useCallback(() => {
    console.log('Ending call');
    
    if (peer) {
      peer.destroy();
      setPeer(null);
    }
    
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped track:', track.kind);
      });
      setStream(null);
    }
    
    setRemoteStream(null);
    setIsConnected(false);
    setIsInitiator(false);
    
    toast({
      title: "Call ended",
      description: "Video call has been disconnected"
    });
  }, [peer, stream]);

  useEffect(() => {
    if (!roomId || !enabled || !user) return;

    console.log('Setting up WebRTC signaling for room:', roomId);

    // Subscribe to WebRTC signaling channel
    const channel = supabase.channel(`webrtc_${roomId}`)
      .on('broadcast', { event: 'webrtc_signal' }, (payload) => {
        const { signal, from } = payload.payload;
        
        // Ignore our own signals
        if (from === user.id) {
          console.log('Ignoring own signal');
          return;
        }

        console.log('Received signal:', signal.type, 'from:', from);
        
        if (signal.type === 'offer' && !peer) {
          console.log('Receiving call offer');
          answerCall(signal);
        } else if (peer && signal.type === 'answer') {
          console.log('Receiving call answer');
          peer.signal(signal);
        } else if (peer && signal.candidate) {
          console.log('Receiving ICE candidate');
          peer.signal(signal);
        }
      })
      .subscribe((status) => {
        console.log('WebRTC channel status:', status);
      });

    channelRef.current = channel;

    return () => {
      console.log('Cleaning up WebRTC channel');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [roomId, enabled, user, peer, answerCall]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endCall();
    };
  }, [endCall]);

  return {
    localVideoRef,
    remoteVideoRef,
    isConnected,
    stream,
    remoteStream,
    isInitiator,
    startCall,
    endCall
  };
};
