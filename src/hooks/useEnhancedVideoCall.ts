import { useState, useRef, useCallback, useEffect } from 'react';
import SimplePeer from 'simple-peer';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';
import { getIceConfig, getIceConfigSync } from '@/lib/webrtc/iceConfig';

export type CallState = 'idle' | 'requesting' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

interface ConnectionQuality {
  level: 0 | 1 | 2 | 3 | 4;
  latency: number;
  packetLoss: number;
}

interface UseEnhancedVideoCallProps {
  roomId: string;
  callId: string | null;
  isInitiator: boolean;
  voiceOnly?: boolean;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

export const useEnhancedVideoCall = ({
  roomId,
  callId,
  isInitiator,
  voiceOnly = false,
  onConnected,
  onDisconnected
}: UseEnhancedVideoCallProps) => {
  const { user } = useAuth();
  
  const peerRef = useRef<SimplePeer.Instance | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const signalQueueRef = useRef<any[]>([]);
  const peerCreatedRef = useRef(false);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [callState, setCallState] = useState<CallState>('idle');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(voiceOnly);
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>({
    level: 0, latency: 0, packetLoss: 0
  });

  const MAX_RECONNECT_ATTEMPTS = 3;

  const cleanup = useCallback(() => {
    console.log('[EnhancedCall] Full cleanup');
    peerCreatedRef.current = false;
    signalQueueRef.current = [];
    reconnectAttemptsRef.current = 0;
    
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
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
    setCallState('idle');
    setConnectionQuality({ level: 0, latency: 0, packetLoss: 0 });
    onDisconnected?.();
  }, [onDisconnected]);

  const getUserMedia = useCallback(async (): Promise<MediaStream | null> => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: voiceOnly ? false : {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 60 }
        }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (error: any) {
      if (!voiceOnly) {
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ 
            audio: { echoCancellation: true, noiseSuppression: true }, video: false 
          });
          localStreamRef.current = audioStream;
          setLocalStream(audioStream);
          setIsCameraOff(true);
          toast({ title: 'Camera unavailable', description: 'Continuing with voice only' });
          return audioStream;
        } catch {
          toast({ title: 'Media access denied', description: 'Please allow camera/microphone access', variant: 'destructive' });
        }
      } else {
        toast({ title: 'Microphone access denied', description: 'Please allow microphone access', variant: 'destructive' });
      }
      return null;
    }
  }, [voiceOnly]);

  const createPeer = useCallback((initiator: boolean, stream: MediaStream, iceConfig: any): SimplePeer.Instance => {
    console.log('[EnhancedCall] Creating peer, initiator:', initiator, 'callId:', callId, 'iceServers:', iceConfig.iceServers?.length);
    
    const peer = new SimplePeer({
      initiator,
      trickle: true,
      stream,
      config: iceConfig
    });

    peer.on('signal', async (signal) => {
      if (!roomId || !user?.id || !callId) return;
      try {
        await supabase.from('rtc_signaling').insert({
          room_id: roomId,
          room_code: roomId.substring(0, 6),
          sender: user.id,
          type: 'call_webrtc',
          payload: { signal, callId }
        });
      } catch (error) {
        console.error('[EnhancedCall] Signal storage failed:', error);
      }
    });

    peer.on('stream', (stream) => {
      console.log('[EnhancedCall] ✅ Received remote stream with', stream.getTracks().length, 'tracks');
      setRemoteStream(stream);
      setCallState('connected');
      reconnectAttemptsRef.current = 0;
      onConnected?.();
      toast({
        title: voiceOnly ? '🎙️ Voice Connected!' : '📹 Video Connected!',
        description: 'You are now connected with your partner'
      });
    });

    peer.on('connect', () => {
      console.log('[EnhancedCall] Data channel connected');
      peerCreatedRef.current = true;
      while (signalQueueRef.current.length > 0) {
        const queuedSignal = signalQueueRef.current.shift();
        try { peer.signal(queuedSignal); } catch {}
      }
    });

    peer.on('close', () => {
      console.log('[EnhancedCall] Peer closed');
      if (callState === 'connected') handleReconnect(iceConfig);
    });

    peer.on('error', (err) => {
      console.error('[EnhancedCall] Peer error:', err);
      handleReconnect(iceConfig);
    });

    setTimeout(() => { peerCreatedRef.current = true; }, 100);
    return peer;
  }, [roomId, user?.id, callId, voiceOnly, onConnected]);

  const handleReconnect = useCallback((iceConfig: any) => {
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setCallState('failed');
      toast({ title: 'Connection failed', description: 'Could not reconnect to call', variant: 'destructive' });
      cleanup();
      return;
    }
    reconnectAttemptsRef.current++;
    setCallState('reconnecting');
    toast({ title: 'Reconnecting...', description: `Attempt ${reconnectAttemptsRef.current} of ${MAX_RECONNECT_ATTEMPTS}` });

    if (peerRef.current) {
      try { peerRef.current.destroy(); } catch {}
      peerRef.current = null;
    }
    peerCreatedRef.current = false;

    setTimeout(() => {
      if (localStreamRef.current && callId) {
        peerRef.current = createPeer(isInitiator, localStreamRef.current, iceConfig);
      }
    }, 1000);
  }, [isInitiator, callId, createPeer, cleanup]);

  const startCall = useCallback(async () => {
    if (!callId) return;
    
    console.log('[EnhancedCall] Starting call:', callId);
    setCallState('requesting');
    
    const stream = await getUserMedia();
    if (!stream) { setCallState('idle'); return; }
    
    setCallState('connecting');
    
    // CRITICAL: Await the async ICE config with TURN servers
    const iceConfig = await getIceConfig();
    console.log('[EnhancedCall] Using ICE config with', iceConfig.iceServers.length, 'servers');
    
    // Clean old signals
    try {
      await supabase.from('rtc_signaling').delete()
        .eq('room_id', roomId).eq('type', 'call_webrtc');
    } catch {}
    
    peerRef.current = createPeer(isInitiator, stream, iceConfig);
    
    // If answering, fetch existing signals
    if (!isInitiator) {
      try {
        const { data: signals } = await supabase
          .from('rtc_signaling').select('*')
          .eq('room_id', roomId).eq('type', 'call_webrtc')
          .order('created_at', { ascending: true });
        
        for (const sig of signals || []) {
          if (sig.sender === user?.id) continue;
          const payload = sig.payload as any;
          if (payload?.callId === callId && payload?.signal) {
            if (peerRef.current && peerCreatedRef.current) {
              try { peerRef.current.signal(payload.signal); } catch {}
            } else {
              signalQueueRef.current.push(payload.signal);
            }
          }
        }
      } catch (error) {
        console.error('[EnhancedCall] Failed to fetch signals:', error);
      }
    }
  }, [callId, roomId, isInitiator, user?.id, getUserMedia, createPeer]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => { track.enabled = !track.enabled; });
      setIsMuted(prev => !prev);
    }
  }, []);

  const toggleCamera = useCallback(() => {
    if (localStreamRef.current && !voiceOnly) {
      localStreamRef.current.getVideoTracks().forEach(track => { track.enabled = !track.enabled; });
      setIsCameraOff(prev => !prev);
    }
  }, [voiceOnly]);

  // Listen for signals
  useEffect(() => {
    if (!roomId || !user?.id || !callId) return;

    const channel = supabase
      .channel(`call_webrtc_${roomId}_${callId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'rtc_signaling',
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        const record = payload.new;
        if (record.sender === user.id) return;
        if (record.type !== 'call_webrtc') return;
        
        const signalData = record.payload as any;
        if (!signalData?.signal || signalData.callId !== callId) return;
        
        if (peerRef.current && peerCreatedRef.current) {
          try { peerRef.current.signal(signalData.signal); } catch (e) {
            signalQueueRef.current.push(signalData.signal);
          }
        } else {
          signalQueueRef.current.push(signalData.signal);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId, user?.id, callId]);

  // Monitor connection quality
  useEffect(() => {
    if (callState !== 'connected' || !peerRef.current) return;

    statsIntervalRef.current = setInterval(async () => {
      try {
        const peer = peerRef.current as any;
        if (!peer?._pc?.getStats) return;
        const stats = await peer._pc.getStats();
        let latency = 0, packetsLost = 0, packetsReceived = 0;
        
        stats.forEach((report: any) => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            latency = Math.round((report.currentRoundTripTime || 0) * 1000);
          }
          if (report.type === 'inbound-rtp') {
            packetsLost += report.packetsLost || 0;
            packetsReceived += report.packetsReceived || 0;
          }
        });
        
        const packetLoss = packetsReceived > 0 
          ? Math.round((packetsLost / (packetsLost + packetsReceived)) * 100 * 10) / 10 : 0;
        
        let level: 0 | 1 | 2 | 3 | 4 = 4;
        if (latency > 500 || packetLoss > 10) level = 1;
        else if (latency > 200 || packetLoss > 5) level = 2;
        else if (latency > 100 || packetLoss > 2) level = 3;
        
        setConnectionQuality({ level, latency, packetLoss });
      } catch {}
    }, 3000);

    return () => {
      if (statsIntervalRef.current) { clearInterval(statsIntervalRef.current); statsIntervalRef.current = null; }
    };
  }, [callState]);

  useEffect(() => { return () => { cleanup(); }; }, []);

  return {
    callState, localStream, remoteStream,
    isMuted, isCameraOff, connectionQuality,
    isConnected: callState === 'connected',
    isConnecting: callState === 'connecting' || callState === 'reconnecting',
    startCall, cleanup, toggleMute, toggleCamera
  };
};
