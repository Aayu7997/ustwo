import { useState, useRef, useCallback, useEffect } from 'react';
import SimplePeer from 'simple-peer';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

// Production ICE configuration with reliable TURN servers
const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.relay.metered.ca:80' },
    {
      urls: 'turn:a.relay.metered.ca:80',
      username: 'c99f0b4ad86e66f8b0ad0e23',
      credential: 'zM1ZQmfR7RxGkjBd'
    },
    {
      urls: 'turn:a.relay.metered.ca:80?transport=tcp',
      username: 'c99f0b4ad86e66f8b0ad0e23',
      credential: 'zM1ZQmfR7RxGkjBd'
    },
    {
      urls: 'turn:a.relay.metered.ca:443',
      username: 'c99f0b4ad86e66f8b0ad0e23',
      credential: 'zM1ZQmfR7RxGkjBd'
    },
    {
      urls: 'turn:a.relay.metered.ca:443?transport=tcp',
      username: 'c99f0b4ad86e66f8b0ad0e23',
      credential: 'zM1ZQmfR7RxGkjBd'
    }
  ]
};

export type ConnectionState = 'idle' | 'requesting' | 'connecting' | 'connected' | 'failed';

interface ConnectionQuality {
  level: 0 | 1 | 2 | 3 | 4;
  latency: number;
  packetLoss: number;
}

interface UseStableVideoCallProps {
  roomId: string;
  callId: string | null;
  isInitiator: boolean;
  voiceOnly?: boolean;
  onConnected?: () => void;
}

export const useStableVideoCall = ({
  roomId,
  callId,
  isInitiator,
  voiceOnly = false,
  onConnected
}: UseStableVideoCallProps) => {
  const { user } = useAuth();
  const peerRef = useRef<SimplePeer.Instance | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const signalQueueRef = useRef<any[]>([]);
  const peerReadyRef = useRef(false);
  
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(voiceOnly);
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>({
    level: 0,
    latency: 0,
    packetLoss: 0
  });

  const MAX_RECONNECT = 3;

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('[VideoCall] Cleanup');
    
    peerReadyRef.current = false;
    signalQueueRef.current = [];
    
    if (peerRef.current) {
      try {
        peerRef.current.destroy();
      } catch {}
      peerRef.current = null;
    }
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    setLocalStream(null);
    setRemoteStream(null);
    setConnectionState('idle');
  }, []);

  // Get user media
  const getUserMedia = useCallback(async (): Promise<MediaStream | null> => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: voiceOnly ? false : {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error('[VideoCall] getUserMedia failed:', error);
      
      // Fallback to audio only
      if (!voiceOnly) {
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ 
            audio: true, 
            video: false 
          });
          localStreamRef.current = audioStream;
          setLocalStream(audioStream);
          setIsCameraOff(true);
          toast({
            title: 'Camera unavailable',
            description: 'Continuing with voice only'
          });
          return audioStream;
        } catch {
          toast({
            title: 'Media access denied',
            description: 'Please allow camera/microphone access',
            variant: 'destructive'
          });
        }
      }
      return null;
    }
  }, [voiceOnly]);

  // Process queued signals
  const processSignalQueue = useCallback(() => {
    if (!peerRef.current || !peerReadyRef.current) return;
    
    while (signalQueueRef.current.length > 0) {
      const signal = signalQueueRef.current.shift();
      try {
        peerRef.current.signal(signal);
        console.log('[VideoCall] Applied queued signal');
      } catch (e) {
        console.error('[VideoCall] Failed to apply queued signal:', e);
      }
    }
  }, []);

  // Create peer connection
  const createPeer = useCallback((initiator: boolean, stream: MediaStream): SimplePeer.Instance => {
    console.log('[VideoCall] Creating peer, initiator:', initiator);
    
    const peer = new SimplePeer({
      initiator,
      trickle: true,
      stream,
      config: ICE_CONFIG
    });

    peer.on('signal', async (signal) => {
      console.log('[VideoCall] Signal generated:', (signal as any)?.type || 'candidate');
      
      if (!roomId || !user?.id || !callId) return;

      try {
        await supabase.from('rtc_signaling').insert({
          room_id: roomId,
          room_code: roomId.substring(0, 6),
          sender: user.id,
          type: 'webrtc_signal',
          payload: { signal, callId }
        });
      } catch (error) {
        console.error('[VideoCall] Signal storage failed:', error);
      }
    });

    peer.on('connect', () => {
      console.log('[VideoCall] Peer data channel connected');
      peerReadyRef.current = true;
      processSignalQueue();
    });

    peer.on('stream', (stream) => {
      console.log('[VideoCall] Received remote stream');
      setRemoteStream(stream);
      setConnectionState('connected');
      reconnectAttemptsRef.current = 0;
      onConnected?.();
    });

    peer.on('close', () => {
      console.log('[VideoCall] Peer closed');
      handleDisconnect();
    });

    peer.on('error', (err) => {
      console.error('[VideoCall] Peer error:', err);
      handleDisconnect();
    });

    // Mark peer as ready for signaling once created
    setTimeout(() => {
      peerReadyRef.current = true;
      processSignalQueue();
    }, 100);

    return peer;
  }, [roomId, user?.id, callId, processSignalQueue, onConnected]);

  // Handle disconnection with auto-reconnect
  const handleDisconnect = useCallback(() => {
    if (connectionState === 'idle') return;
    
    if (reconnectAttemptsRef.current < MAX_RECONNECT && callId) {
      reconnectAttemptsRef.current++;
      setConnectionState('connecting');
      
      console.log(`[VideoCall] Reconnect attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT}`);
      
      toast({
        title: 'Reconnecting...',
        description: `Attempt ${reconnectAttemptsRef.current} of ${MAX_RECONNECT}`
      });
      
      // Destroy old peer and create new one
      if (peerRef.current) {
        try { peerRef.current.destroy(); } catch {}
        peerRef.current = null;
      }
      
      peerReadyRef.current = false;
      
      if (localStreamRef.current) {
        peerRef.current = createPeer(isInitiator, localStreamRef.current);
      }
    } else {
      setConnectionState('failed');
      toast({
        title: 'Connection failed',
        description: 'Could not establish video call',
        variant: 'destructive'
      });
    }
  }, [connectionState, callId, isInitiator, createPeer]);

  // Start the call
  const startCall = useCallback(async () => {
    if (!callId) return;
    
    setConnectionState('requesting');
    
    const stream = await getUserMedia();
    if (!stream) {
      setConnectionState('idle');
      return;
    }
    
    setConnectionState('connecting');
    
    // Clean old signals for this call
    try {
      await supabase
        .from('rtc_signaling')
        .delete()
        .eq('room_id', roomId)
        .eq('type', 'webrtc_signal');
    } catch {}
    
    // Create peer
    peerRef.current = createPeer(isInitiator, stream);
    
    // If not initiator, fetch and apply any existing signals
    if (!isInitiator) {
      try {
        const { data: signals } = await supabase
          .from('rtc_signaling')
          .select('*')
          .eq('room_id', roomId)
          .eq('type', 'webrtc_signal')
          .order('created_at', { ascending: true });
        
        for (const sig of signals || []) {
          if (sig.sender === user?.id) continue;
          const payload = sig.payload as any;
          if (payload?.callId === callId && payload?.signal) {
            signalQueueRef.current.push(payload.signal);
          }
        }
        processSignalQueue();
      } catch (error) {
        console.error('[VideoCall] Failed to fetch signals:', error);
      }
    }
  }, [callId, roomId, isInitiator, user?.id, getUserMedia, createPeer, processSignalQueue]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  // Toggle camera
  const toggleCamera = useCallback(() => {
    if (localStreamRef.current && !voiceOnly) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsCameraOff(!isCameraOff);
    }
  }, [isCameraOff, voiceOnly]);

  // Listen for WebRTC signals
  useEffect(() => {
    if (!roomId || !user?.id || !callId) return;

    const channel = supabase
      .channel(`webrtc_signals_${roomId}_${callId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'rtc_signaling',
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        const record = payload.new;
        
        if (record.sender === user.id) return;
        if (record.type !== 'webrtc_signal') return;
        
        const signalData = record.payload as any;
        if (!signalData?.signal || signalData.callId !== callId) return;
        
        console.log('[VideoCall] Received signal from DB');
        
        if (peerRef.current && peerReadyRef.current) {
          try {
            peerRef.current.signal(signalData.signal);
          } catch (e) {
            console.log('[VideoCall] Signal error, queueing:', e);
            signalQueueRef.current.push(signalData.signal);
          }
        } else {
          signalQueueRef.current.push(signalData.signal);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, user?.id, callId]);

  // Monitor connection quality
  useEffect(() => {
    if (connectionState !== 'connected' || !peerRef.current) return;

    const interval = setInterval(async () => {
      try {
        const peer = peerRef.current as any;
        if (!peer?._pc?.getStats) return;
        
        const stats = await peer._pc.getStats();
        let latency = 0;
        let packetsLost = 0;
        let packetsReceived = 0;
        
        stats.forEach((report: any) => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            latency = (report.currentRoundTripTime || 0) * 1000;
          }
          if (report.type === 'inbound-rtp') {
            packetsLost += report.packetsLost || 0;
            packetsReceived += report.packetsReceived || 0;
          }
        });
        
        const packetLoss = packetsReceived > 0 
          ? (packetsLost / (packetsLost + packetsReceived)) * 100 
          : 0;
        
        let level: 0 | 1 | 2 | 3 | 4 = 4;
        if (latency > 500 || packetLoss > 10) level = 1;
        else if (latency > 200 || packetLoss > 5) level = 2;
        else if (latency > 100 || packetLoss > 2) level = 3;
        
        setConnectionQuality({ level, latency, packetLoss });
      } catch {}
    }, 3000);

    return () => clearInterval(interval);
  }, [connectionState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return {
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
  };
};
