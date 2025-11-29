import { useEffect, useRef, useState, useCallback } from 'react';
import SimplePeer from 'simple-peer';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

interface EnhancedWebRTCProps {
  roomId: string;
  roomCode?: string;
  enabled: boolean;
  voiceOnly?: boolean;
}

export const useEnhancedWebRTC = ({ 
  roomId, 
  roomCode, 
  enabled,
  voiceOnly = false 
}: EnhancedWebRTCProps) => {
  const { user } = useAuth();
  const [peer, setPeer] = useState<SimplePeer.Instance | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor' | 'disconnected'>('disconnected');
  const [isInitiator, setIsInitiator] = useState(false);
  
  const channelRef = useRef<any>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const statsIntervalRef = useRef<NodeJS.Timeout>();

  // Get media with Discord/WhatsApp quality settings
  const initializeMedia = useCallback(async () => {
    try {
      console.log('[WebRTC] Initializing media, voice only:', voiceOnly);
      
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('getUserMedia not supported');
      }

      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 2
        },
        video: voiceOnly ? false : {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, min: 15 },
          facingMode: 'user'
        }
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      console.log('[WebRTC] Media obtained:', {
        audio: mediaStream.getAudioTracks().length,
        video: mediaStream.getVideoTracks().length
      });
      
      setStream(mediaStream);

      if (!voiceOnly && localVideoRef.current) {
        localVideoRef.current.srcObject = mediaStream;
        localVideoRef.current.muted = true;
        localVideoRef.current.playsInline = true;
        await localVideoRef.current.play().catch(console.error);
      }

      toast({
        title: voiceOnly ? "🎙️ Microphone Ready" : "📹 Camera & Mic Ready",
        description: voiceOnly ? "Voice chat is ready" : "Video call is ready"
      });

      return mediaStream;
    } catch (error) {
      console.error('[WebRTC] Media init failed:', error);
      
      let message = "Failed to access media devices";
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          message = "Permission denied. Please allow camera/microphone access.";
        } else if (error.name === 'NotFoundError') {
          message = "No camera/microphone found.";
        } else if (error.name === 'NotReadableError') {
          message = "Device is already in use.";
        }
      }
      
      toast({ title: "Media Access Error", description: message, variant: "destructive" });
      throw error;
    }
  }, [voiceOnly]);

  // Monitor connection quality
  const monitorConnectionQuality = useCallback((peer: SimplePeer.Instance) => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
    }

    statsIntervalRef.current = setInterval(() => {
      if (!peer._pc) return;

      peer._pc.getStats().then(stats => {
        let bytesReceived = 0;
        let packetLoss = 0;

        stats.forEach(report => {
          if (report.type === 'inbound-rtp') {
            bytesReceived = report.bytesReceived || 0;
            packetLoss = report.packetsLost || 0;
          }
        });

        // Determine quality based on packet loss
        if (packetLoss === 0) {
          setConnectionQuality('excellent');
        } else if (packetLoss < 5) {
          setConnectionQuality('good');
        } else {
          setConnectionQuality('poor');
        }
      }).catch(console.error);
    }, 2000);
  }, []);

  // Create peer with enhanced configuration
  const createPeer = useCallback((initiator: boolean, stream: MediaStream) => {
    console.log('[WebRTC] Creating peer, initiator:', initiator);
    
    const newPeer = new SimplePeer({
      initiator,
      trickle: true, // Enable trickle ICE for faster connection
      stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' },
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
        ],
        iceCandidatePoolSize: 10,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require'
      }
    });

    // Signal handling
    newPeer.on('signal', async (data) => {
      console.log('[WebRTC] Sending signal:', data.type);
      
      try {
        await supabase
          .from('rtc_signaling')
          .insert({
            room_id: roomId,
            room_code: roomCode || '',
            type: data.type || 'candidate',
            payload: data,
            sender: user?.id
          });
      } catch (error) {
        console.error('[WebRTC] Failed to send signal:', error);
      }
    });

    // Remote stream handling
    newPeer.on('stream', (remoteStream) => {
      console.log('[WebRTC] Received remote stream');
      setRemoteStream(remoteStream);
      
      if (!voiceOnly && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch(console.error);
      }
    });

    // Connection established
    newPeer.on('connect', () => {
      console.log('[WebRTC] Connection established');
      setIsConnected(true);
      setConnectionQuality('good');
      
      // Start monitoring quality
      monitorConnectionQuality(newPeer);
      
      toast({
        title: voiceOnly ? "🎙️ Voice Connected" : "💕 Video Call Connected",
        description: "You're now connected!"
      });
    });

    // Connection closed
    newPeer.on('close', () => {
      console.log('[WebRTC] Connection closed');
      setIsConnected(false);
      setConnectionQuality('disconnected');
      setRemoteStream(null);
      
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }
    });

    // Error handling with auto-reconnect
    newPeer.on('error', (error) => {
      console.error('[WebRTC] Error:', error);
      setConnectionQuality('poor');
      
      // Attempt reconnection after 3 seconds
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      reconnectTimeoutRef.current = setTimeout(() => {
        if (enabled) {
          console.log('[WebRTC] Attempting reconnection...');
          toast({
            title: "Reconnecting...",
            description: "Attempting to restore connection"
          });
        }
      }, 3000);
    });

    return newPeer;
  }, [user?.id, roomId, roomCode, voiceOnly, enabled, monitorConnectionQuality]);

  // Start call
  const startCall = useCallback(async () => {
    if (!enabled || !user) return;

    try {
      console.log('[WebRTC] Starting call');
      const mediaStream = await initializeMedia();
      const newPeer = createPeer(true, mediaStream);
      setPeer(newPeer);
      setIsInitiator(true);
      
      toast({
        title: "Starting call...",
        description: "Waiting for partner"
      });
    } catch (error) {
      console.error('[WebRTC] Failed to start call:', error);
      throw error;
    }
  }, [enabled, user, initializeMedia, createPeer]);

  // Answer call
  const answerCall = useCallback(async (signal: any) => {
    if (!enabled || !user) return;

    try {
      console.log('[WebRTC] Answering call');
      const mediaStream = await initializeMedia();
      const newPeer = createPeer(false, mediaStream);
      setPeer(newPeer);
      setIsInitiator(false);
      
      newPeer.signal(signal);
      
      toast({
        title: "Joining call...",
        description: "Connecting..."
      });
    } catch (error) {
      console.error('[WebRTC] Failed to answer call:', error);
    }
  }, [enabled, user, initializeMedia, createPeer]);

  // End call
  const endCall = useCallback(() => {
    console.log('[WebRTC] Ending call');
    
    if (peer) {
      peer.destroy();
      setPeer(null);
    }
    
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
        console.log('[WebRTC] Stopped track:', track.kind);
      });
      setStream(null);
    }
    
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    setRemoteStream(null);
    setIsConnected(false);
    setConnectionQuality('disconnected');
    setIsInitiator(false);
  }, [peer, stream]);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return audioTrack.enabled;
      }
    }
    return false;
  }, [stream]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (stream && !voiceOnly) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        return videoTrack.enabled;
      }
    }
    return false;
  }, [stream, voiceOnly]);

  // Listen for signals
  useEffect(() => {
    if (!roomId || !enabled || !user) return;

    console.log('[WebRTC] Setting up signaling channel');

    const channel = supabase
      .channel(`rtc_signal_${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'rtc_signaling',
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        const signalData = payload.new as any;
        
        if (signalData.sender === user.id) {
          console.log('[WebRTC] Ignoring own signal');
          return;
        }

        console.log('[WebRTC] Received signal:', signalData.type);
        const signal = signalData.payload;

        if (signal.type === 'offer' && !peer) {
          answerCall(signal);
        } else if (peer && (signal.type === 'answer' || signal.candidate)) {
          peer.signal(signal);
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      console.log('[WebRTC] Cleaning up signaling');
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
    connectionQuality,
    stream,
    remoteStream,
    isInitiator,
    startCall,
    endCall,
    toggleAudio,
    toggleVideo,
    peer
  };
};