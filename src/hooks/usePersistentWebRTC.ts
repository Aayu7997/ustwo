import { useEffect, useRef, useState, useCallback } from 'react';
import SimplePeer from 'simple-peer';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';
import { getVideoConstraints, VideoQuality, DEFAULT_QUALITY } from '@/utils/videoQuality';

interface PersistentWebRTCProps {
  roomId: string;
  roomCode?: string;
  enabled: boolean;
  quality?: VideoQuality;
}

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'reconnecting';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { 
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },
  { 
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },
  { 
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  }
];

export const usePersistentWebRTC = ({ roomId, roomCode, enabled, quality = DEFAULT_QUALITY }: PersistentWebRTCProps) => {
  const { user } = useAuth();
  const [peer, setPeer] = useState<SimplePeer.Instance | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [isInitiator, setIsInitiator] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor'>('excellent');
  
  const channelRef = useRef<any>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 3;
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  // Initialize media stream
  const initializeMedia = useCallback(async () => {
    try {
      console.log('[WebRTC] Requesting media with quality:', quality);
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: getVideoConstraints(quality),
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      console.log('[WebRTC] Media stream obtained');
      setStream(mediaStream);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = mediaStream;
        localVideoRef.current.muted = true;
        localVideoRef.current.playsInline = true;
      }
      
      return mediaStream;
    } catch (error) {
      console.error('[WebRTC] Media initialization error:', error);
      toast({
        title: "Camera Access Required",
        description: "Please allow camera and microphone access",
        variant: "destructive"
      });
      throw error;
    }
  }, [quality]);

  // Create peer connection with proper configuration
  const createPeer = useCallback(async (initiator: boolean, mediaStream: MediaStream) => {
    console.log(`[WebRTC] Creating peer (initiator: ${initiator})`);
    setConnectionState('connecting');

    try {
      const newPeer = new SimplePeer({
        initiator,
        stream: mediaStream,
        trickle: true,
        config: {
          iceServers: ICE_SERVERS,
          iceTransportPolicy: 'all',
          bundlePolicy: 'max-bundle',
          rtcpMuxPolicy: 'require',
          sdpSemantics: 'unified-plan'
        },
        offerOptions: {
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        }
      });

      // Handle signaling
      newPeer.on('signal', async (signal) => {
        console.log('[WebRTC] Signaling:', signal.type);
        
        try {
          const { error } = await supabase
            .from('rtc_signaling')
            .insert({
              room_id: roomId,
              room_code: roomCode || '',
              sender: user?.id,
              type: signal.type,
              payload: signal
            });

          if (error) throw error;
        } catch (err) {
          console.error('[WebRTC] Signaling error:', err);
        }
      });

      // Handle incoming stream
      newPeer.on('stream', (remoteMediaStream) => {
        console.log('[WebRTC] Received remote stream');
        setRemoteStream(remoteMediaStream);
        
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteMediaStream;
          remoteVideoRef.current.playsInline = true;
        }
      });

      // Connection established
      newPeer.on('connect', () => {
        console.log('[WebRTC] Peer connected');
        setConnectionState('connected');
        reconnectAttemptsRef.current = 0;
        
        toast({
          title: "Connected",
          description: "Video call connected successfully",
        });
      });

      // Monitor ICE connection state
      newPeer.on('iceStateChange', (iceConnectionState: RTCIceConnectionState, iceGatheringState: RTCIceGatheringState) => {
        console.log('[WebRTC] ICE State:', iceConnectionState);

        switch (iceConnectionState) {
          case 'checking':
            setConnectionQuality('poor');
            break;
          case 'connected':
          case 'completed':
            setConnectionQuality('excellent');
            break;
          case 'disconnected':
            setConnectionState('disconnected');
            setConnectionQuality('poor');
            // Attempt reconnection
            if (reconnectAttemptsRef.current < maxReconnectAttempts) {
              handleReconnect();
            }
            break;
          case 'failed':
            setConnectionState('failed');
            toast({
              title: "Connection Failed",
              description: "Unable to establish connection. Please try again.",
              variant: "destructive"
            });
            break;
          case 'closed':
            setConnectionState('idle');
            break;
        }
      });

      // Handle errors
      newPeer.on('error', (err) => {
        console.error('[WebRTC] Peer error:', err);
        setConnectionState('failed');
      });

      // Handle close
      newPeer.on('close', () => {
        console.log('[WebRTC] Peer closed');
        setConnectionState('idle');
      });

      setPeer(newPeer);
      return newPeer;
    } catch (error) {
      console.error('[WebRTC] Peer creation error:', error);
      setConnectionState('failed');
      throw error;
    }
  }, [roomId, roomCode, user]);

  // Handle reconnection
  const handleReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.log('[WebRTC] Max reconnect attempts reached');
      toast({
        title: "Connection Lost",
        description: "Please refresh to reconnect",
        variant: "destructive"
      });
      return;
    }

    reconnectAttemptsRef.current += 1;
    setConnectionState('reconnecting');
    
    console.log(`[WebRTC] Reconnecting... Attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts}`);
    
    toast({
      title: "Reconnecting...",
      description: `Attempt ${reconnectAttemptsRef.current} of ${maxReconnectAttempts}`,
    });

    // Delay before reconnection
    reconnectTimeoutRef.current = setTimeout(() => {
      if (stream) {
        startCall();
      }
    }, 2000 * reconnectAttemptsRef.current); // Exponential backoff
  }, [stream]);

  // Start call
  const startCall = useCallback(async () => {
    try {
      const mediaStream = await initializeMedia();
      const initiator = true;
      setIsInitiator(initiator);
      await createPeer(initiator, mediaStream);
    } catch (error) {
      console.error('[WebRTC] Start call error:', error);
    }
  }, [initializeMedia, createPeer]);

  // End call
  const endCall = useCallback(() => {
    console.log('[WebRTC] Ending call');
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (peer) {
      peer.destroy();
      setPeer(null);
    }

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    setRemoteStream(null);
    setConnectionState('idle');
    reconnectAttemptsRef.current = 0;
  }, [peer, stream]);

  // Listen for incoming signals
  useEffect(() => {
    if (!enabled || !user || !roomCode) return;

    console.log('[WebRTC] Setting up signaling subscription');
    
    const channel = supabase
      .channel(`rtc_signaling:${roomCode}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'rtc_signaling',
          filter: `room_code=eq.${roomCode}`
        },
        async (payload: any) => {
          const signal = payload.new;
          
          // Ignore own signals
          if (signal.sender === user.id) return;
          
          console.log('[WebRTC] Received signal:', signal.type);

          try {
            if (signal.type === 'offer' && !peer) {
              // Received offer, create answering peer
              const mediaStream = await initializeMedia();
              setIsInitiator(false);
              const newPeer = await createPeer(false, mediaStream);
              newPeer.signal(signal.payload);
            } else if (signal.type === 'answer' && peer) {
              // Received answer
              peer.signal(signal.payload);
            } else if (peer && signal.payload.candidate) {
              // ICE candidate
              peer.signal(signal.payload);
            }
          } catch (error) {
            console.error('[WebRTC] Signal handling error:', error);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, roomCode, user, peer, initializeMedia, createPeer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endCall();
    };
  }, []);

  return {
    localVideoRef,
    remoteVideoRef,
    connectionState,
    isConnected: connectionState === 'connected',
    stream,
    remoteStream,
    isInitiator,
    connectionQuality,
    startCall,
    endCall
  };
};
