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
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      setStream(mediaStream);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = mediaStream;
        localVideoRef.current.muted = true; // Prevent feedback
      }
      
      return mediaStream;
    } catch (error) {
      console.error('Failed to get media:', error);
      let errorMessage = "Failed to access camera/microphone";
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = "Camera/microphone access denied. Please allow permissions.";
        } else if (error.name === 'NotFoundError') {
          errorMessage = "No camera/microphone found.";
        } else if (error.name === 'NotReadableError') {
          errorMessage = "Camera/microphone is already in use.";
        }
      }
      
      toast({
        title: "Camera Access",
        description: errorMessage,
        variant: "destructive"
      });
      throw error;
    }
  }, []);

  const createPeer = useCallback((initiator: boolean, stream: MediaStream) => {
    const newPeer = new SimplePeer({
      initiator,
      trickle: false,
      stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      }
    });

    newPeer.on('signal', (data) => {
      console.log('Sending WebRTC signal:', data.type);
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
      console.log('Received remote stream with tracks:', remoteStream.getTracks().length);
      setRemoteStream(remoteStream);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    });

    newPeer.on('connect', () => {
      console.log('WebRTC peer connection established');
      setIsConnected(true);
      toast({
        title: "Video Call Connected! 💕",
        description: "You're now connected for video chat!"
      });
    });

    newPeer.on('close', () => {
      console.log('WebRTC connection closed');
      setIsConnected(false);
      setRemoteStream(null);
    });

    newPeer.on('error', (error) => {
      console.error('WebRTC peer error:', error);
      
      // Try to reconnect automatically
      setTimeout(() => {
        if (!isConnected) {
          console.log('Attempting to reconnect...');
          startCall();
        }
      }, 3000);
      
      toast({
        title: "Connection Issue",
        description: "Trying to reconnect automatically...",
        variant: "destructive"
      });
    });

    return newPeer;
  }, [user?.id, isConnected]);

  const startCall = useCallback(async () => {
    if (!enabled || !user) return;

    try {
      const mediaStream = await initializeMedia();
      const newPeer = createPeer(true, mediaStream);
      setPeer(newPeer);
      setIsInitiator(true);
    } catch (error) {
      console.error('Failed to start call:', error);
    }
  }, [enabled, user, initializeMedia, createPeer]);

  const answerCall = useCallback(async (signal: any) => {
    if (!enabled || !user) return;

    try {
      const mediaStream = await initializeMedia();
      const newPeer = createPeer(false, mediaStream);
      setPeer(newPeer);
      setIsInitiator(false);
      
      // Answer the call
      newPeer.signal(signal);
    } catch (error) {
      console.error('Failed to answer call:', error);
    }
  }, [enabled, user, initializeMedia, createPeer]);

  const endCall = useCallback(() => {
    if (peer) {
      peer.destroy();
      setPeer(null);
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setRemoteStream(null);
    setIsConnected(false);
    setIsInitiator(false);
  }, [peer, stream]);

  useEffect(() => {
    if (!roomId || !enabled || !user) return;

    // Subscribe to WebRTC signaling channel
    const channel = supabase.channel(`webrtc_${roomId}`)
      .on('broadcast', { event: 'webrtc_signal' }, (payload) => {
        const { signal, from } = payload.payload;
        
        // Ignore our own signals
        if (from === user.id) return;

        console.log('Received WebRTC signal:', signal);
        
        if (signal.type === 'offer' && !peer) {
          // Someone is calling us
          answerCall(signal);
        } else if (peer && signal.type === 'answer') {
          // Answer to our call
          peer.signal(signal);
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
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