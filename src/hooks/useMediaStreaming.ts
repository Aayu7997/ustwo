import { useState, useRef, useCallback, useEffect } from 'react';
import SimplePeer from 'simple-peer';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';
import { getIceConfigSync } from '@/lib/webrtc/iceConfig';

interface UseMediaStreamingProps {
  roomId: string;
  roomCode?: string;
  enabled?: boolean;
}

interface StreamingState {
  isStreaming: boolean;
  isReceiving: boolean;
  connectionState: 'idle' | 'connecting' | 'connected' | 'failed';
  streamerId: string | null;
}

export const useMediaStreaming = ({ roomId, roomCode, enabled = true }: UseMediaStreamingProps) => {
  const { user } = useAuth();
  const peerRef = useRef<SimplePeer.Instance | null>(null);
  const channelRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  
  const [state, setState] = useState<StreamingState>({
    isStreaming: false,
    isReceiving: false,
    connectionState: 'idle',
    streamerId: null
  });
  
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // Clean up peer connection
  const cleanup = useCallback(() => {
    console.log('[MediaStreaming] Cleanup');
    
    if (peerRef.current) {
      try { peerRef.current.destroy(); } catch {}
      peerRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setRemoteStream(null);
    setState({
      isStreaming: false,
      isReceiving: false,
      connectionState: 'idle',
      streamerId: null
    });
  }, []);

  // Create peer connection
  const createPeer = useCallback((initiator: boolean, stream?: MediaStream) => {
    console.log('[MediaStreaming] Creating peer, initiator:', initiator, 'has stream:', !!stream);
    
    const peer = new SimplePeer({
      initiator,
      // Use non-trickle signaling to avoid partial/duplicate candidate races
      // and keep DB signaling simple & reliable.
      trickle: false,
      stream: stream || undefined,
      config: getIceConfigSync()
    });


    peer.on('signal', async (signal) => {
      console.log('[MediaStreaming] Signal generated:', (signal as any)?.type ?? 'signal');

      if (!roomId || !user?.id) return;

      try {
        // Store each signal as a row. We clean old rows at stream/join start,
        // which avoids clearing mid-handshake.
        await supabase.from('rtc_signaling').insert({
          room_id: roomId,
          room_code: roomCode || roomId.substring(0, 6),
          sender: user.id,
          type: 'stream_signal',
          payload: { signal, isStreamer: initiator }
        });
      } catch (error) {
        console.error('[MediaStreaming] Failed to send signal:', error);
      }
    });

    peer.on('stream', (remoteStream) => {
      console.log('[MediaStreaming] Received remote stream');
      setRemoteStream(remoteStream);
      setState(prev => ({
        ...prev,
        isReceiving: true,
        connectionState: 'connected'
      }));
      
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch(e => {
          console.log('[MediaStreaming] Autoplay blocked:', e);
        });
      }
      
      toast({
        title: "Partner is streaming! 🎬",
        description: "Live video sync active"
      });
    });

    peer.on('connect', () => {
      console.log('[MediaStreaming] Peer connected');
      setState(prev => ({
        ...prev,
        connectionState: 'connected'
      }));
    });

    peer.on('close', () => {
      console.log('[MediaStreaming] Peer closed');
      cleanup();
    });

    peer.on('error', (err) => {
      console.error('[MediaStreaming] Peer error:', err);

      toast({
        title: "Streaming Error",
        description: "Connection failed. Try again.",
        variant: "destructive"
      });

      // Reset UI so we don't end up with a blank "receiving" state.
      cleanup();
    });

    return peer;
  }, [roomId, roomCode, user?.id, cleanup]);

  // Start streaming local video
  const startStreaming = useCallback(async (videoElement: HTMLVideoElement) => {
    if (!user?.id || !roomId || !enabled) {
      console.log('[MediaStreaming] Cannot start - missing requirements');
      return false;
    }
    
    cleanup();
    localVideoRef.current = videoElement;
    
    setState(prev => ({
      ...prev,
      isStreaming: true,
      connectionState: 'connecting',
      streamerId: user.id
    }));
    
    try {
      // Capture video element stream (includes audio)
      // captureStream is not in standard types but is widely supported
      const videoEl = videoElement as HTMLVideoElement & {
        captureStream?: () => MediaStream;
        mozCaptureStream?: () => MediaStream;
      };
      
      const capturedStream = videoEl.captureStream?.() ?? videoEl.mozCaptureStream?.();
      
      if (!capturedStream) {
        throw new Error('captureStream not supported in your browser');
      }
      
      console.log('[MediaStreaming] Captured stream:', capturedStream.getTracks().map(t => t.kind));
      streamRef.current = capturedStream;

      // Clear our previous signals so the receiver doesn't apply stale offers.
      try {
        await supabase
          .from('rtc_signaling')
          .delete()
          .eq('room_id', roomId)
          .eq('sender', user.id)
          .eq('type', 'stream_signal');
      } catch (e) {
        console.warn('[MediaStreaming] Failed to clear old signals (non-fatal):', e);
      }
      
      // Broadcast that we're starting to stream
      if (channelRef.current) {
        await channelRef.current.send({
          type: 'broadcast',
          event: 'stream_start',
          payload: { streamerId: user.id }
        });
      }
      
      // Create peer as initiator with stream
      peerRef.current = createPeer(true, capturedStream);
      
      toast({
        title: "Streaming Started! 📡",
        description: "Your video is now being shared with your partner"
      });
      
      return true;
    } catch (error) {
      console.error('[MediaStreaming] Failed to start streaming:', error);
      cleanup();
      
      toast({
        title: "Streaming Failed",
        description: error instanceof Error ? error.message : "Could not capture video",
        variant: "destructive"
      });
      
      return false;
    }
  }, [user?.id, roomId, enabled, cleanup, createPeer]);

  // Stop streaming
  const stopStreaming = useCallback(async () => {
    console.log('[MediaStreaming] Stopping stream');
    
    if (channelRef.current) {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'stream_stop',
        payload: { streamerId: user?.id }
      });
    }
    
    cleanup();
    
    toast({
      title: "Streaming Stopped",
      description: "Your video is no longer being shared"
    });
  }, [user?.id, cleanup]);

  // Join as receiver
  const joinStream = useCallback(async (streamerId: string) => {
    if (!user?.id || !roomId || user.id === streamerId) return;
    
    console.log('[MediaStreaming] Joining stream from:', streamerId);
    
    setState(prev => ({
      ...prev,
      isReceiving: true,
      connectionState: 'connecting',
      streamerId
    }));
    
    // Clear our previous receiver signals (prevents stale answers)
    try {
      await supabase
        .from('rtc_signaling')
        .delete()
        .eq('room_id', roomId)
        .eq('sender', user.id)
        .eq('type', 'stream_signal');
    } catch (e) {
      console.warn('[MediaStreaming] Failed to clear old signals (non-fatal):', e);
    }

    // Create peer as receiver (non-initiator)
    peerRef.current = createPeer(false);
    
    // Get the streamer's signals
    try {
      const { data: signals } = await supabase
        .from('rtc_signaling')
        .select('*')
        .eq('room_id', roomId)
        .eq('sender', streamerId)
        .eq('type', 'stream_signal')
        .order('created_at', { ascending: true });
      
      if (signals && signals.length > 0) {
        for (const sig of signals) {
          const payload = sig.payload as any;
          if (payload?.signal && peerRef.current) {
            console.log('[MediaStreaming] Applying stored signal');
            try {
              peerRef.current.signal(payload.signal);
            } catch {}
          }
        }
      }
    } catch (error) {
      console.error('[MediaStreaming] Failed to fetch signals:', error);
    }
  }, [user?.id, roomId, createPeer]);

  // Subscribe to streaming events and signals
  useEffect(() => {
    if (!roomId || !user?.id || !enabled) return;
    
    console.log('[MediaStreaming] Setting up channels for room:', roomId);
    
    // Broadcast channel for stream events
    const broadcastChannel = supabase
      .channel(`stream_broadcast_${roomId}`)
      .on('broadcast', { event: 'stream_start' }, async (payload) => {
        const { streamerId } = payload.payload;
        if (streamerId === user.id) return;
        
        console.log('[MediaStreaming] Partner started streaming:', streamerId);
        
        // Auto-join the stream
        await joinStream(streamerId);
      })
      .on('broadcast', { event: 'stream_stop' }, (payload) => {
        const { streamerId } = payload.payload;
        if (streamerId === user.id) return;
        
        console.log('[MediaStreaming] Partner stopped streaming');
        
        // Only cleanup remote stream state, don't affect local player
        if (peerRef.current) {
          try { peerRef.current.destroy(); } catch {}
          peerRef.current = null;
        }
        
        setRemoteStream(null);
        setState(prev => ({
          ...prev,
          isReceiving: false,
          connectionState: 'idle',
          streamerId: null
        }));
        
        toast({
          title: "Stream Ended",
          description: "Partner stopped sharing their video"
        });
      })
      .subscribe();
    
    channelRef.current = broadcastChannel;
    
    // DB channel for signaling
    const signalingChannel = supabase
      .channel(`stream_signals_${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'rtc_signaling',
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        const signal = payload.new;
        
        if (signal.sender === user.id) return;
        if (signal.type !== 'stream_signal') return;
        
        const signalData = signal.payload as any;
        if (!signalData?.signal) return;
        
        console.log('[MediaStreaming] Received signal from DB');
        
        // If we're streaming and this is from a receiver, or vice versa
        if (peerRef.current) {
          try {
            peerRef.current.signal(signalData.signal);
          } catch (e) {
            console.log('[MediaStreaming] Signal error (may be duplicate):', e);
          }
        } else if (!state.isStreaming && signalData.isStreamer) {
          // Someone started streaming, join them
          joinStream(signal.sender);
        }
      })
      .subscribe();
    
    // Check for existing streamer on mount
    const checkExistingStream = async () => {
      try {
        const { data } = await supabase
          .from('rtc_signaling')
          .select('*')
          .eq('room_id', roomId)
          .eq('type', 'stream_signal')
          .neq('sender', user.id)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (data && data.length > 0) {
          const latestSignal = data[0];
          const payload = latestSignal.payload as any;
          
          // Check if signal is recent (within 30 seconds)
          const signalTime = new Date(latestSignal.created_at).getTime();
          const now = Date.now();
          
          if (now - signalTime < 30000 && payload?.isStreamer) {
            console.log('[MediaStreaming] Found existing streamer:', latestSignal.sender);
            await joinStream(latestSignal.sender);
          }
        }
      } catch (error) {
        console.error('[MediaStreaming] Error checking existing stream:', error);
      }
    };
    
    checkExistingStream();
    
    return () => {
      supabase.removeChannel(broadcastChannel);
      supabase.removeChannel(signalingChannel);
      cleanup();
    };
  }, [roomId, user?.id, enabled, cleanup, joinStream, state.isStreaming]);

  // Sync playback state for streamer
  const syncPlaybackState = useCallback((currentTime: number, isPlaying: boolean) => {
    if (!channelRef.current || !state.isStreaming) return;
    
    channelRef.current.send({
      type: 'broadcast',
      event: 'stream_playback',
      payload: { currentTime, isPlaying }
    });
  }, [state.isStreaming]);

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
    syncPlaybackState,
    cleanup
  };
};
