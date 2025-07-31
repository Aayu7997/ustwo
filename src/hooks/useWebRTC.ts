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
        video: { width: 640, height: 480 },
        audio: true
      });
      setStream(mediaStream);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = mediaStream;
      }
      
      return mediaStream;
    } catch (error) {
      console.error('Failed to get media:', error);
      toast({
        title: "Camera Access",
        description: "Failed to access camera/microphone",
        variant: "destructive"
      });
      throw error;
    }
  }, []);

  const createPeer = useCallback((initiator: boolean, stream: MediaStream) => {
    const newPeer = new SimplePeer({
      initiator,
      trickle: false,
      stream
    });

    newPeer.on('signal', (data) => {
      console.log('Sending signal:', data);
      channelRef.current?.send({
        type: 'broadcast',
        event: 'webrtc_signal',
        payload: {
          signal: data,
          from: user?.id
        }
      });
    });

    newPeer.on('stream', (remoteStream) => {
      console.log('Received remote stream');
      setRemoteStream(remoteStream);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    });

    newPeer.on('connect', () => {
      console.log('WebRTC connection established');
      setIsConnected(true);
      toast({
        title: "Video Call Connected",
        description: "You're now connected for video chat!"
      });
    });

    newPeer.on('close', () => {
      console.log('WebRTC connection closed');
      setIsConnected(false);
      setRemoteStream(null);
    });

    newPeer.on('error', (error) => {
      console.error('WebRTC error:', error);
      toast({
        title: "Connection Error",
        description: "Video call connection failed",
        variant: "destructive"
      });
    });

    return newPeer;
  }, [user?.id]);

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