import { useState, useRef, useCallback, useEffect } from 'react';
import SimplePeer from 'simple-peer';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

// Production ICE config with OpenRelay TURN
const ICE_CONFIG = {
  iceServers: [
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
      urls: 'turns:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:a.relay.metered.ca:80',
      username: 'c99f0b4ad86e66f8b0ad0e23',
      credential: 'zM1ZQmfR7RxGkjBd'
    }
  ]
};

interface StreamingState {
  isStreaming: boolean;
  isReceiving: boolean;
  connectionState: 'idle' | 'connecting' | 'connected' | 'failed';
  streamerId: string | null;
}

interface UseEnhancedStreamingProps {
  roomId: string;
  roomCode?: string;
  enabled?: boolean;
}

export const useEnhancedStreaming = ({ roomId, roomCode, enabled = true }: UseEnhancedStreamingProps) => {
  const { user } = useAuth();
  const peerRef = useRef<SimplePeer.Instance | null>(null);
  const channelRef = useRef<any>(null);
  const dbChannelRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const streamIdRef = useRef<string | null>(null);
  const isCleaningUpRef = useRef(false);
  
  const [state, setState] = useState<StreamingState>({
    isStreaming: false,
    isReceiving: false,
    connectionState: 'idle',
    streamerId: null
  });
  
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // Generate stream ID
  const generateStreamId = useCallback(() => {
    return `stream_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }, []);

  // Clean up peer connection only
  const cleanupPeer = useCallback(() => {
    console.log('[Streaming] Cleanup peer');
    
    if (peerRef.current) {
      try { peerRef.current.destroy(); } catch {}
      peerRef.current = null;
    }
  }, []);

  // Full cleanup
  const cleanup = useCallback(() => {
    if (isCleaningUpRef.current) return;
    isCleaningUpRef.current = true;
    
    console.log('[Streaming] Full cleanup');
    
    cleanupPeer();
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    streamIdRef.current = null;
    localVideoRef.current = null;
    
    setRemoteStream(null);
    setState({
      isStreaming: false,
      isReceiving: false,
      connectionState: 'idle',
      streamerId: null
    });
    
    setTimeout(() => {
      isCleaningUpRef.current = false;
    }, 100);
  }, [cleanupPeer]);

  // Create peer connection
  const createPeer = useCallback((initiator: boolean, stream?: MediaStream): SimplePeer.Instance => {
    console.log('[Streaming] Creating peer, initiator:', initiator, 'has stream:', !!stream);
    
    const peer = new SimplePeer({
      initiator,
      trickle: false, // Non-trickle for simpler signaling
      stream: stream || undefined,
      config: ICE_CONFIG
    });

    peer.on('signal', async (signal) => {
      console.log('[Streaming] Signal generated');

      if (!roomId || !user?.id) return;

      try {
        await supabase.from('rtc_signaling').insert({
          room_id: roomId,
          room_code: roomCode || roomId.substring(0, 6),
          sender: user.id,
          type: 'media_stream',
          payload: { signal, streamId: streamIdRef.current, isStreamer: initiator }
        });
      } catch (error) {
        console.error('[Streaming] Failed to send signal:', error);
      }
    });

    peer.on('stream', (incomingStream) => {
      console.log('[Streaming] Received remote stream');
      setRemoteStream(incomingStream);
      setState(prev => ({
        ...prev,
        isReceiving: true,
        connectionState: 'connected'
      }));
      
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = incomingStream;
        remoteVideoRef.current.play().catch(() => {});
      }
      
      toast({
        title: "Partner is streaming! 🎬",
        description: "Live video sync active"
      });
    });

    peer.on('connect', () => {
      console.log('[Streaming] Peer connected');
      setState(prev => ({
        ...prev,
        connectionState: 'connected'
      }));
    });

    peer.on('close', () => {
      console.log('[Streaming] Peer closed');
      if (!isCleaningUpRef.current) {
        cleanupPeer();
        setRemoteStream(null);
        setState(prev => ({
          ...prev,
          isReceiving: false,
          connectionState: 'idle'
        }));
      }
    });

    peer.on('error', (err) => {
      console.error('[Streaming] Peer error:', err);
      if (!isCleaningUpRef.current) {
        toast({
          title: "Streaming Error",
          description: "Connection failed. Try again.",
          variant: "destructive"
        });
        cleanupPeer();
        setState(prev => ({ ...prev, connectionState: 'failed' }));
      }
    });

    return peer;
  }, [roomId, roomCode, user?.id, cleanupPeer]);

  // Start streaming local video
  const startStreaming = useCallback(async (videoElement: HTMLVideoElement): Promise<boolean> => {
    if (!user?.id || !roomId || !enabled) {
      console.log('[Streaming] Cannot start - missing requirements');
      return false;
    }

    // If already streaming, stop first
    if (state.isStreaming) {
      await stopStreaming();
      return false;
    }
    
    console.log('[Streaming] Starting stream');
    
    cleanup();
    localVideoRef.current = videoElement;
    
    const streamId = generateStreamId();
    streamIdRef.current = streamId;
    
    setState(prev => ({
      ...prev,
      isStreaming: true,
      connectionState: 'connecting',
      streamerId: user.id
    }));
    
    try {
      // Capture video element stream
      const videoEl = videoElement as HTMLVideoElement & {
        captureStream?: () => MediaStream;
        mozCaptureStream?: () => MediaStream;
      };
      
      const capturedStream = videoEl.captureStream?.() ?? videoEl.mozCaptureStream?.();
      
      if (!capturedStream) {
        throw new Error('captureStream not supported');
      }
      
      console.log('[Streaming] Captured stream:', capturedStream.getTracks().map(t => t.kind));
      streamRef.current = capturedStream;

      // Clear old signals
      try {
        await supabase
          .from('rtc_signaling')
          .delete()
          .eq('room_id', roomId)
          .eq('sender', user.id)
          .eq('type', 'media_stream');
      } catch {}
      
      // Broadcast stream start
      if (channelRef.current) {
        await channelRef.current.send({
          type: 'broadcast',
          event: 'stream_start',
          payload: { streamerId: user.id, streamId }
        });
      }
      
      // Create peer as initiator
      peerRef.current = createPeer(true, capturedStream);
      
      toast({
        title: "Streaming Started! 📡",
        description: "Your video is now being shared"
      });
      
      return true;
    } catch (error) {
      console.error('[Streaming] Failed to start:', error);
      cleanup();
      
      toast({
        title: "Streaming Failed",
        description: error instanceof Error ? error.message : "Could not capture video",
        variant: "destructive"
      });
      
      return false;
    }
  }, [user?.id, roomId, enabled, state.isStreaming, cleanup, generateStreamId, createPeer]);

  // Stop streaming
  const stopStreaming = useCallback(async () => {
    console.log('[Streaming] Stopping stream');
    
    // Broadcast stop
    if (channelRef.current && user?.id) {
      try {
        await channelRef.current.send({
          type: 'broadcast',
          event: 'stream_stop',
          payload: { streamerId: user.id }
        });
      } catch {}
    }
    
    cleanup();
    
    toast({
      title: "Streaming Stopped",
      description: "Your video is no longer being shared"
    });
  }, [user?.id, cleanup]);

  // Toggle streaming
  const toggleStreaming = useCallback(async (videoElement: HTMLVideoElement): Promise<boolean> => {
    if (state.isStreaming) {
      await stopStreaming();
      return false;
    } else {
      return await startStreaming(videoElement);
    }
  }, [state.isStreaming, startStreaming, stopStreaming]);

  // Join as receiver
  const joinStream = useCallback(async (streamerId: string, streamId: string) => {
    if (!user?.id || !roomId || user.id === streamerId) return;
    
    console.log('[Streaming] Joining stream from:', streamerId);
    
    // Don't join if already streaming ourselves
    if (state.isStreaming) {
      console.log('[Streaming] Cannot join - we are streaming');
      return;
    }
    
    streamIdRef.current = streamId;
    
    setState(prev => ({
      ...prev,
      isReceiving: true,
      connectionState: 'connecting',
      streamerId
    }));
    
    // Clear our old receiver signals
    try {
      await supabase
        .from('rtc_signaling')
        .delete()
        .eq('room_id', roomId)
        .eq('sender', user.id)
        .eq('type', 'media_stream');
    } catch {}

    // Create peer as receiver
    peerRef.current = createPeer(false);
    
    // Fetch and apply streamer's signals
    try {
      const { data: signals } = await supabase
        .from('rtc_signaling')
        .select('*')
        .eq('room_id', roomId)
        .eq('sender', streamerId)
        .eq('type', 'media_stream')
        .order('created_at', { ascending: true });
      
      for (const sig of signals || []) {
        const payload = sig.payload as any;
        if (payload?.signal && payload?.streamId === streamId && peerRef.current) {
          console.log('[Streaming] Applying stored signal');
          try {
            peerRef.current.signal(payload.signal);
          } catch {}
        }
      }
    } catch (error) {
      console.error('[Streaming] Failed to fetch signals:', error);
    }
  }, [user?.id, roomId, state.isStreaming, createPeer]);

  // Subscribe to streaming events
  useEffect(() => {
    if (!roomId || !user?.id || !enabled) return;
    
    console.log('[Streaming] Setting up channels for room:', roomId);
    
    // Broadcast channel
    const channel = supabase
      .channel(`stream_${roomId}`)
      .on('broadcast', { event: 'stream_start' }, async ({ payload }) => {
        const { streamerId, streamId } = payload;
        if (streamerId === user.id) return;
        
        console.log('[Streaming] Partner started streaming:', streamerId);
        await joinStream(streamerId, streamId);
      })
      .on('broadcast', { event: 'stream_stop' }, ({ payload }) => {
        const { streamerId } = payload;
        if (streamerId === user.id) return;
        
        console.log('[Streaming] Partner stopped streaming');
        cleanupPeer();
        setRemoteStream(null);
        setState(prev => ({
          ...prev,
          isReceiving: false,
          connectionState: 'idle',
          streamerId: null
        }));
        
        toast({
          title: "Stream Ended",
          description: "Partner stopped sharing"
        });
      })
      .subscribe();
    
    channelRef.current = channel;
    
    // DB channel for signaling
    const dbChannel = supabase
      .channel(`stream_db_${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'rtc_signaling',
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        const signal = payload.new;
        
        if (signal.sender === user.id) return;
        if (signal.type !== 'media_stream') return;
        
        const signalData = signal.payload as any;
        if (!signalData?.signal) return;
        
        console.log('[Streaming] Received signal from DB');
        
        // Apply signal if we have a peer
        if (peerRef.current) {
          try {
            peerRef.current.signal(signalData.signal);
          } catch (e) {
            console.log('[Streaming] Signal error (may be duplicate):', e);
          }
        } else if (!state.isStreaming && signalData.isStreamer) {
          // Someone started streaming, join them
          joinStream(signal.sender, signalData.streamId);
        }
      })
      .subscribe();
    
    dbChannelRef.current = dbChannel;
    
    // Check for existing stream on mount
    const checkExistingStream = async () => {
      try {
        const { data } = await supabase
          .from('rtc_signaling')
          .select('*')
          .eq('room_id', roomId)
          .eq('type', 'media_stream')
          .neq('sender', user.id)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (data && data.length > 0) {
          const latestSignal = data[0];
          const payload = latestSignal.payload as any;
          
          // Check if signal is recent (within 30 seconds)
          const signalTime = new Date(latestSignal.created_at).getTime();
          
          if (Date.now() - signalTime < 30000 && payload?.isStreamer && payload?.streamId) {
            console.log('[Streaming] Found existing streamer:', latestSignal.sender);
            await joinStream(latestSignal.sender, payload.streamId);
          }
        }
      } catch (error) {
        console.error('[Streaming] Error checking existing stream:', error);
      }
    };
    
    checkExistingStream();
    
    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(dbChannel);
      cleanup();
    };
  }, [roomId, user?.id, enabled]);

  return {
    // State
    isStreaming: state.isStreaming,
    isReceiving: state.isReceiving,
    connectionState: state.connectionState,
    streamerId: state.streamerId,
    remoteStream,
    
    // Refs
    remoteVideoRef,
    
    // Actions
    startStreaming,
    stopStreaming,
    toggleStreaming,
    cleanup
  };
};
