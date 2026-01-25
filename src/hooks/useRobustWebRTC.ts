import { useEffect, useRef, useState, useCallback } from 'react';
import SimplePeer from 'simple-peer';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useCallCoordination } from './useCallCoordination';
import { toast } from '@/hooks/use-toast';

interface UseRobustWebRTCProps {
  roomId: string;
  roomCode?: string;
  enabled: boolean;
  voiceOnly?: boolean;
}

type ConnectionState = 'idle' | 'requesting' | 'connecting' | 'connected' | 'failed' | 'ended';

export const useRobustWebRTC = ({
  roomId,
  roomCode,
  enabled,
  voiceOnly = false
}: UseRobustWebRTCProps) => {
  const { user } = useAuth();
  const {
    callId,
    isInitiator,
    startCallSession,
    endCallSession,
    isValidSignal,
    clearStaleSignals
  } = useCallCoordination({ roomId, enabled });

  const [peer, setPeer] = useState<SimplePeer.Instance | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor' | 'disconnected'>('disconnected');

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const channelRef = useRef<any>(null);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 3;

  // Get media
  const initializeMedia = useCallback(async () => {
    setConnectionState('requesting');
    
    try {
      console.log('[RobustWebRTC] Requesting media, voiceOnly:', voiceOnly);
      
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: voiceOnly ? false : {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        }
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      if (!voiceOnly && localVideoRef.current) {
        localVideoRef.current.srcObject = mediaStream;
        localVideoRef.current.muted = true;
        await localVideoRef.current.play().catch(() => {});
      }

      console.log('[RobustWebRTC] Media acquired');
      return mediaStream;
    } catch (error: any) {
      console.error('[RobustWebRTC] Media error:', error);
      setConnectionState('failed');
      
      let message = 'Failed to access media devices';
      if (error.name === 'NotAllowedError') {
        message = 'Permission denied. Please allow camera/microphone.';
      } else if (error.name === 'NotFoundError') {
        message = 'No camera/microphone found.';
      }
      
      toast({ title: 'Media Error', description: message, variant: 'destructive' });
      throw error;
    }
  }, [voiceOnly]);

  // Monitor connection quality
  const monitorQuality = useCallback((peerInstance: SimplePeer.Instance) => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
    }

    statsIntervalRef.current = setInterval(() => {
      if (!peerInstance._pc) return;

      peerInstance._pc.getStats().then(stats => {
        let packetLoss = 0;
        
        stats.forEach(report => {
          if (report.type === 'inbound-rtp' && report.packetsLost) {
            packetLoss = report.packetsLost;
          }
        });

        if (packetLoss === 0) setConnectionQuality('excellent');
        else if (packetLoss < 5) setConnectionQuality('good');
        else setConnectionQuality('poor');
      }).catch(() => {});
    }, 3000);
  }, []);

  // Create peer connection
  const createPeer = useCallback((initiator: boolean, mediaStream: MediaStream, currentCallId: string) => {
    console.log('[RobustWebRTC] Creating peer, initiator:', initiator, 'callId:', currentCallId);
    setConnectionState('connecting');

    const newPeer = new SimplePeer({
      initiator,
      trickle: true,
      stream: mediaStream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun.relay.metered.ca:80' },
          {
            urls: 'turn:a.relay.metered.ca:80',
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
        ],
        iceCandidatePoolSize: 10
      }
    });

    // Send signals with call ID
    newPeer.on('signal', async (data) => {
      console.log('[RobustWebRTC] Sending signal:', data.type, 'callId:', currentCallId);
      
      try {
        await supabase.from('rtc_signaling').insert({
          room_id: roomId,
          room_code: roomCode || '',
          type: data.type || 'candidate',
          payload: { ...data, callId: currentCallId },
          sender: user?.id
        });
      } catch (error) {
        console.error('[RobustWebRTC] Signal send failed:', error);
      }
    });

    newPeer.on('stream', (remote) => {
      console.log('[RobustWebRTC] Received remote stream');
      setRemoteStream(remote);
      
      if (!voiceOnly && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remote;
        remoteVideoRef.current.play().catch(() => {
          console.log('[RobustWebRTC] Autoplay blocked for remote video');
        });
      }
    });

    newPeer.on('connect', () => {
      console.log('[RobustWebRTC] Connected!');
      setConnectionState('connected');
      reconnectAttempts.current = 0;
      monitorQuality(newPeer);
      toast({ title: voiceOnly ? '🎙️ Voice Connected' : '💕 Video Connected' });
    });

    newPeer.on('close', () => {
      console.log('[RobustWebRTC] Connection closed');
      handleDisconnect();
    });

    newPeer.on('error', (error) => {
      console.error('[RobustWebRTC] Error:', error);
      
      // Check if it's a recoverable error
      const errorMessage = error.message || String(error);
      const isRecoverable = errorMessage.includes('ICE') || errorMessage.includes('timeout');
      
      if (isRecoverable && reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current++;
        console.log('[RobustWebRTC] Reconnect attempt:', reconnectAttempts.current);
        toast({ title: 'Reconnecting...', description: `Attempt ${reconnectAttempts.current}` });
        // Don't set failed state for recoverable errors
      } else {
        setConnectionState('failed');
        toast({ title: 'Connection Failed', description: 'Unable to establish connection', variant: 'destructive' });
      }
    });

    return newPeer;
  }, [roomId, roomCode, user?.id, voiceOnly, monitorQuality]);

  // Handle disconnect
  const handleDisconnect = useCallback(() => {
    setConnectionState('ended');
    setConnectionQuality('disconnected');
    setRemoteStream(null);
    
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
  }, []);

  // Start call
  const startCall = useCallback(async () => {
    if (!enabled || !user) return;

    try {
      // Clear old signals first
      await clearStaleSignals();
      
      const mediaStream = await initializeMedia();
      const newCallId = await startCallSession();
      
      if (!newCallId) {
        throw new Error('Failed to create call session');
      }

      const newPeer = createPeer(true, mediaStream, newCallId);
      setPeer(newPeer);
    } catch (error) {
      console.error('[RobustWebRTC] Start call failed:', error);
      setConnectionState('failed');
    }
  }, [enabled, user, clearStaleSignals, initializeMedia, startCallSession, createPeer]);

  // End call
  const endCall = useCallback(() => {
    console.log('[RobustWebRTC] Ending call');
    
    if (peer) {
      peer.destroy();
      setPeer(null);
    }
    
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
    
    endCallSession();
    setRemoteStream(null);
    setConnectionState('idle');
    setConnectionQuality('disconnected');
  }, [peer, stream, endCallSession]);

  // Toggle audio
  const toggleAudio = useCallback((): boolean => {
    if (stream) {
      const track = stream.getAudioTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        return track.enabled;
      }
    }
    return false;
  }, [stream]);

  // Toggle video
  const toggleVideo = useCallback((): boolean => {
    if (stream && !voiceOnly) {
      const track = stream.getVideoTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        return track.enabled;
      }
    }
    return false;
  }, [stream, voiceOnly]);

  // Listen for signals
  useEffect(() => {
    if (!roomId || !enabled || !user) return;

    console.log('[RobustWebRTC] Setting up signal listener');

    const channel = supabase
      .channel(`rtc_robust_${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'rtc_signaling',
        filter: `room_id=eq.${roomId}`
      }, async (payload) => {
        const signal = payload.new as any;
        
        // Skip own signals
        if (signal.sender === user.id) return;
        
        const signalPayload = signal.payload;
        const signalCallId = signalPayload?.callId;

        console.log('[RobustWebRTC] Received signal:', signal.type, 'callId:', signalCallId);

        // Handle offer from partner
        if (signalPayload.type === 'offer') {
          // If we're already in a call, ignore
          if (peer && connectionState === 'connected') {
            console.log('[RobustWebRTC] Ignoring offer, already connected');
            return;
          }

          // Answer the call
          try {
            const mediaStream = stream || await initializeMedia();
            const newPeer = createPeer(false, mediaStream, signalCallId);
            newPeer.signal(signalPayload);
            setPeer(newPeer);
          } catch (error) {
            console.error('[RobustWebRTC] Failed to answer:', error);
          }
        } else if (peer && (signalPayload.type === 'answer' || signalPayload.candidate)) {
          // Only process signals for current call
          if (signalCallId && callId && signalCallId !== callId) {
            console.log('[RobustWebRTC] Ignoring stale signal');
            return;
          }
          peer.signal(signalPayload);
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, enabled, user, peer, stream, callId, connectionState, initializeMedia, createPeer]);

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
    connectionQuality,
    stream,
    remoteStream,
    isInitiator,
    isConnected: connectionState === 'connected',
    isLoading: connectionState === 'requesting' || connectionState === 'connecting',
    isFailed: connectionState === 'failed',
    startCall,
    endCall,
    toggleAudio,
    toggleVideo
  };
};
