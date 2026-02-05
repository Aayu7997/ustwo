import { useState, useRef, useCallback, useEffect } from 'react';
import SimplePeer from 'simple-peer';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';
import { getIceConfigSync } from '@/lib/webrtc/iceConfig';

export type CallState = 'idle' | 'requesting' | 'connecting' | 'connected' | 'failed' | 'ended';

interface ConnectionQuality {
  level: 0 | 1 | 2 | 3 | 4;
  latency: number;
  packetLoss: number;
}

interface UseProductionVideoCallProps {
  roomId: string;
  roomCode?: string;
  voiceOnly?: boolean;
}

export const useProductionVideoCall = ({ roomId, roomCode, voiceOnly = false }: UseProductionVideoCallProps) => {
  const { user } = useAuth();
  const peerRef = useRef<SimplePeer.Instance | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<any>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const callIdRef = useRef<string>(`call_${Date.now()}`);
  
  const [callState, setCallState] = useState<CallState>('idle');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(voiceOnly);
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>({ 
    level: 0, 
    latency: 0, 
    packetLoss: 0 
  });

  const MAX_RECONNECT_ATTEMPTS = 3;

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('[VideoCall] Cleanup');
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (peerRef.current) {
      try { peerRef.current.destroy(); } catch {}
      peerRef.current = null;
    }
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    setLocalStream(null);
    setRemoteStream(null);
    remoteStreamRef.current = null;
  }, []);

  // Get user media with proper constraints
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
          frameRate: { ideal: 30, max: 60 },
          facingMode: 'user'
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error('[VideoCall] getUserMedia failed:', error);
      
      // Try audio-only fallback
      if (!voiceOnly) {
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          localStreamRef.current = audioStream;
          setLocalStream(audioStream);
          setIsCameraOff(true);
          toast({
            title: 'Camera unavailable',
            description: 'Continuing with voice only',
          });
          return audioStream;
        } catch {
          toast({
            title: 'Media access denied',
            description: 'Please allow camera/microphone access',
            variant: 'destructive'
          });
          return null;
        }
      }
      return null;
    }
  }, [voiceOnly]);

  // Create peer connection
  const createPeer = useCallback((initiator: boolean, stream: MediaStream): SimplePeer.Instance => {
    console.log('[VideoCall] Creating peer, initiator:', initiator);
    
    const peer = new SimplePeer({
      initiator,
      trickle: true, // Use trickle ICE for faster connection
      stream,
      config: getIceConfigSync()
    });

    peer.on('signal', async (signal) => {
      console.log('[VideoCall] Signal generated:', (signal as any)?.type || 'candidate');
      
      if (!roomId || !user?.id) return;

      try {
        await supabase.from('rtc_signaling').insert({
          room_id: roomId,
          room_code: roomCode || roomId.substring(0, 6),
          sender: user.id,
          type: 'video_call',
          payload: { 
            signal, 
            callId: callIdRef.current,
            isInitiator: initiator 
          }
        });
      } catch (error) {
        console.error('[VideoCall] Signal storage failed:', error);
      }
    });

    peer.on('stream', (stream) => {
      console.log('[VideoCall] Received remote stream');
      remoteStreamRef.current = stream;
      setRemoteStream(stream);
      setCallState('connected');
      reconnectAttemptsRef.current = 0;
      
      toast({
        title: 'Connected! 💕',
        description: 'Video call is now active'
      });
    });

    peer.on('connect', () => {
      console.log('[VideoCall] Peer connected');
      setCallState('connected');
      reconnectAttemptsRef.current = 0;
    });

    peer.on('close', () => {
      console.log('[VideoCall] Peer closed');
      handleDisconnect();
    });

    peer.on('error', (err) => {
      console.error('[VideoCall] Peer error:', err);
      handleDisconnect();
    });

    return peer;
  }, [roomId, roomCode, user?.id]);

  // Handle disconnection with auto-reconnect
  const handleDisconnect = useCallback(() => {
    if (callState === 'ended' || callState === 'idle') return;
    
    if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
      setCallState('connecting');
      reconnectAttemptsRef.current++;
      
      console.log(`[VideoCall] Attempting reconnect (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);
      
      toast({
        title: 'Reconnecting...',
        description: `Attempt ${reconnectAttemptsRef.current} of ${MAX_RECONNECT_ATTEMPTS}`
      });
      
      // Attempt reconnect after delay
      reconnectTimeoutRef.current = window.setTimeout(() => {
        if (peerRef.current) {
          try { peerRef.current.destroy(); } catch {}
          peerRef.current = null;
        }
        
        if (localStreamRef.current) {
          // Re-initiate as determinate party (smaller user ID)
          const shouldInitiate = user?.id && user.id < (roomId || '');
          peerRef.current = createPeer(shouldInitiate, localStreamRef.current);
        }
      }, 2000);
    } else {
      setCallState('failed');
      toast({
        title: 'Connection failed',
        description: 'Could not reconnect. Try again.',
        variant: 'destructive'
      });
      cleanup();
    }
  }, [callState, user?.id, roomId, createPeer, cleanup]);

  // Start call
  const startCall = useCallback(async () => {
    if (callState !== 'idle') return;
    
    setCallState('requesting');
    callIdRef.current = `call_${Date.now()}_${user?.id}`;
    
    // Get user media
    const stream = await getUserMedia();
    if (!stream) {
      setCallState('idle');
      return;
    }
    
    setCallState('connecting');
    
    // Clean up old signaling
    try {
      await supabase
        .from('rtc_signaling')
        .delete()
        .eq('room_id', roomId)
        .eq('type', 'video_call');
    } catch {}
    
    // Broadcast call request
    if (channelRef.current) {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'call_request',
        payload: { 
          callerId: user?.id,
          callId: callIdRef.current,
          voiceOnly
        }
      });
    }
    
    // Create peer as initiator
    peerRef.current = createPeer(true, stream);
    
    toast({
      title: voiceOnly ? 'Starting voice call...' : 'Starting video call...',
      description: 'Waiting for partner to connect'
    });
  }, [callState, user?.id, roomId, voiceOnly, getUserMedia, createPeer]);

  // Answer call
  const answerCall = useCallback(async (callId: string) => {
    if (callState !== 'idle') return;
    
    setCallState('requesting');
    callIdRef.current = callId;
    
    const stream = await getUserMedia();
    if (!stream) {
      setCallState('idle');
      return;
    }
    
    setCallState('connecting');
    
    // Create peer as non-initiator
    peerRef.current = createPeer(false, stream);
    
    // Apply any pending signals
    try {
      const { data: signals } = await supabase
        .from('rtc_signaling')
        .select('*')
        .eq('room_id', roomId)
        .eq('type', 'video_call')
        .order('created_at', { ascending: true });
      
      for (const sig of signals || []) {
        if (sig.sender === user?.id) continue;
        const payload = sig.payload as any;
        if (payload?.callId === callId && payload?.signal && peerRef.current) {
          try {
            peerRef.current.signal(payload.signal);
          } catch {}
        }
      }
    } catch (error) {
      console.error('[VideoCall] Failed to apply signals:', error);
    }
  }, [callState, roomId, user?.id, getUserMedia, createPeer]);

  // End call
  const endCall = useCallback(() => {
    console.log('[VideoCall] Ending call');
    
    setCallState('ended');
    
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'call_ended',
        payload: { userId: user?.id, callId: callIdRef.current }
      });
    }
    
    cleanup();
    
    // Reset to idle after a moment
    setTimeout(() => setCallState('idle'), 100);
  }, [user?.id, cleanup]);

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

  // Subscribe to signaling
  useEffect(() => {
    if (!roomId || !user?.id) return;

    const channel = supabase
      .channel(`video_call_${roomId}`)
      .on('broadcast', { event: 'call_request' }, (payload) => {
        const { callerId, callId, voiceOnly: isVoiceOnly } = payload.payload;
        if (callerId === user.id) return;
        
        console.log('[VideoCall] Incoming call from:', callerId);
        
        // Auto-answer if not in a call
        if (callState === 'idle') {
          toast({
            title: isVoiceOnly ? 'Incoming voice call...' : 'Incoming video call...',
            description: 'Connecting automatically'
          });
          answerCall(callId);
        }
      })
      .on('broadcast', { event: 'call_ended' }, (payload) => {
        const { userId } = payload.payload;
        if (userId === user.id) return;
        
        console.log('[VideoCall] Partner ended call');
        cleanup();
        setCallState('idle');
        
        toast({
          title: 'Call ended',
          description: 'Your partner ended the call'
        });
      })
      .subscribe();

    channelRef.current = channel;

    // DB signaling listener
    const signalingChannel = supabase
      .channel(`video_call_signals_${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'rtc_signaling',
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        const signal = payload.new;
        
        if (signal.sender === user.id) return;
        if (signal.type !== 'video_call') return;
        
        const signalData = signal.payload as any;
        if (!signalData?.signal) return;
        
        // Only apply signals for our current call
        if (signalData.callId !== callIdRef.current) return;
        
        console.log('[VideoCall] Received signal from DB');
        
        if (peerRef.current) {
          try {
            peerRef.current.signal(signalData.signal);
          } catch (e) {
            console.log('[VideoCall] Signal error:', e);
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(signalingChannel);
    };
  }, [roomId, user?.id, callState, answerCall, cleanup]);

  // Monitor connection quality
  useEffect(() => {
    if (callState !== 'connected' || !peerRef.current) return;

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
            latency = report.currentRoundTripTime * 1000;
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
  }, [callState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return {
    callState,
    localStream,
    remoteStream,
    isMuted,
    isCameraOff,
    connectionQuality,
    startCall,
    endCall,
    toggleMute,
    toggleCamera,
    voiceOnly
  };
};
