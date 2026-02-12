import { useState, useRef, useCallback, useEffect } from 'react';
import SimplePeer from 'simple-peer';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';
import { getIceConfig, getIceConfigSync } from '@/lib/webrtc/iceConfig';

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
    isStreaming: false, isReceiving: false, connectionState: 'idle', streamerId: null
  });
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const generateStreamId = useCallback(() => `stream_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`, []);

  const cleanupPeer = useCallback(() => {
    if (peerRef.current) { try { peerRef.current.destroy(); } catch {} peerRef.current = null; }
  }, []);

  const cleanup = useCallback(() => {
    if (isCleaningUpRef.current) return;
    isCleaningUpRef.current = true;
    cleanupPeer();
    if (streamRef.current) { streamRef.current.getTracks().forEach(track => track.stop()); streamRef.current = null; }
    streamIdRef.current = null;
    localVideoRef.current = null;
    setRemoteStream(null);
    setState({ isStreaming: false, isReceiving: false, connectionState: 'idle', streamerId: null });
    setTimeout(() => { isCleaningUpRef.current = false; }, 100);
  }, [cleanupPeer]);

  const createPeer = useCallback(async (initiator: boolean, stream?: MediaStream): Promise<SimplePeer.Instance> => {
    // CRITICAL: Await async ICE config for TURN servers
    const iceConfig = await getIceConfig();
    console.log('[Streaming] Creating peer with', iceConfig.iceServers.length, 'ICE servers, initiator:', initiator);
    
    const peer = new SimplePeer({
      initiator, trickle: false, stream: stream || undefined, config: iceConfig
    });

    peer.on('signal', async (signal) => {
      if (!roomId || !user?.id) return;
      try {
        await supabase.from('rtc_signaling').insert({
          room_id: roomId, room_code: roomCode || roomId.substring(0, 6),
          sender: user.id, type: 'media_stream',
          payload: { signal, streamId: streamIdRef.current, isStreamer: initiator }
        });
      } catch (error) { console.error('[Streaming] Signal failed:', error); }
    });

    peer.on('stream', (incomingStream) => {
      console.log('[Streaming] ✅ Received remote stream');
      setRemoteStream(incomingStream);
      setState(prev => ({ ...prev, isReceiving: true, connectionState: 'connected' }));
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = incomingStream;
        remoteVideoRef.current.play().catch(() => {});
      }
      toast({ title: "Partner is streaming! 🎬", description: "Live video sync active" });
    });

    peer.on('connect', () => { setState(prev => ({ ...prev, connectionState: 'connected' })); });
    peer.on('close', () => {
      if (!isCleaningUpRef.current) { cleanupPeer(); setRemoteStream(null); setState(prev => ({ ...prev, isReceiving: false, connectionState: 'idle' })); }
    });
    peer.on('error', (err) => {
      console.error('[Streaming] Peer error:', err);
      if (!isCleaningUpRef.current) {
        toast({ title: "Streaming Error", description: "Connection failed. Try again.", variant: "destructive" });
        cleanupPeer();
        setState(prev => ({ ...prev, connectionState: 'failed' }));
      }
    });

    return peer;
  }, [roomId, roomCode, user?.id, cleanupPeer]);

  const startStreaming = useCallback(async (videoElement: HTMLVideoElement): Promise<boolean> => {
    if (!user?.id || !roomId || !enabled) return false;
    if (state.isStreaming) { await stopStreaming(); return false; }
    
    cleanup();
    localVideoRef.current = videoElement;
    const streamId = generateStreamId();
    streamIdRef.current = streamId;
    setState(prev => ({ ...prev, isStreaming: true, connectionState: 'connecting', streamerId: user.id }));
    
    try {
      const videoEl = videoElement as any;
      const capturedStream = videoEl.captureStream?.() ?? videoEl.mozCaptureStream?.();
      if (!capturedStream) throw new Error('captureStream not supported');
      streamRef.current = capturedStream;

      try { await supabase.from('rtc_signaling').delete().eq('room_id', roomId).eq('sender', user.id).eq('type', 'media_stream'); } catch {}
      
      if (channelRef.current) {
        await channelRef.current.send({ type: 'broadcast', event: 'stream_start', payload: { streamerId: user.id, streamId } });
      }
      
      peerRef.current = await createPeer(true, capturedStream);
      toast({ title: "Streaming Started! 📡", description: "Your video is now being shared" });
      return true;
    } catch (error) {
      console.error('[Streaming] Failed to start:', error);
      cleanup();
      toast({ title: "Streaming Failed", description: error instanceof Error ? error.message : "Could not capture video", variant: "destructive" });
      return false;
    }
  }, [user?.id, roomId, enabled, state.isStreaming, cleanup, generateStreamId, createPeer]);

  const stopStreaming = useCallback(async () => {
    if (channelRef.current && user?.id) {
      try { await channelRef.current.send({ type: 'broadcast', event: 'stream_stop', payload: { streamerId: user.id } }); } catch {}
    }
    cleanup();
    toast({ title: "Streaming Stopped" });
  }, [user?.id, cleanup]);

  const toggleStreaming = useCallback(async (videoElement: HTMLVideoElement): Promise<boolean> => {
    if (state.isStreaming) { await stopStreaming(); return false; }
    return await startStreaming(videoElement);
  }, [state.isStreaming, startStreaming, stopStreaming]);

  const joinStream = useCallback(async (streamerId: string, streamId: string) => {
    if (!user?.id || !roomId || user.id === streamerId || state.isStreaming) return;
    
    streamIdRef.current = streamId;
    setState(prev => ({ ...prev, isReceiving: true, connectionState: 'connecting', streamerId }));
    
    try { await supabase.from('rtc_signaling').delete().eq('room_id', roomId).eq('sender', user.id).eq('type', 'media_stream'); } catch {}

    peerRef.current = await createPeer(false);
    
    try {
      const { data: signals } = await supabase.from('rtc_signaling').select('*')
        .eq('room_id', roomId).eq('sender', streamerId).eq('type', 'media_stream')
        .order('created_at', { ascending: true });
      
      for (const sig of signals || []) {
        const payload = sig.payload as any;
        if (payload?.signal && payload?.streamId === streamId && peerRef.current) {
          try { peerRef.current.signal(payload.signal); } catch {}
        }
      }
    } catch (error) { console.error('[Streaming] Failed to fetch signals:', error); }
  }, [user?.id, roomId, state.isStreaming, createPeer]);

  useEffect(() => {
    if (!roomId || !user?.id || !enabled) return;
    
    const channel = supabase.channel(`stream_${roomId}`)
      .on('broadcast', { event: 'stream_start' }, async ({ payload }) => {
        if (payload.streamerId === user.id) return;
        await joinStream(payload.streamerId, payload.streamId);
      })
      .on('broadcast', { event: 'stream_stop' }, ({ payload }) => {
        if (payload.streamerId === user.id) return;
        cleanupPeer(); setRemoteStream(null);
        setState(prev => ({ ...prev, isReceiving: false, connectionState: 'idle', streamerId: null }));
        toast({ title: "Stream Ended" });
      })
      .subscribe();
    channelRef.current = channel;
    
    const dbChannel = supabase.channel(`stream_db_${roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rtc_signaling', filter: `room_id=eq.${roomId}` }, (payload) => {
        const signal = payload.new;
        if (signal.sender === user.id || signal.type !== 'media_stream') return;
        const signalData = signal.payload as any;
        if (!signalData?.signal) return;
        
        if (peerRef.current) {
          try { peerRef.current.signal(signalData.signal); } catch {}
        } else if (!state.isStreaming && signalData.isStreamer) {
          joinStream(signal.sender, signalData.streamId);
        }
      })
      .subscribe();
    dbChannelRef.current = dbChannel;
    
    const checkExistingStream = async () => {
      try {
        const { data } = await supabase.from('rtc_signaling').select('*')
          .eq('room_id', roomId).eq('type', 'media_stream').neq('sender', user.id)
          .order('created_at', { ascending: false }).limit(1);
        
        if (data?.[0]) {
          const payload = data[0].payload as any;
          const signalTime = new Date(data[0].created_at).getTime();
          if (Date.now() - signalTime < 30000 && payload?.isStreamer && payload?.streamId) {
            await joinStream(data[0].sender, payload.streamId);
          }
        }
      } catch {}
    };
    checkExistingStream();
    
    return () => { supabase.removeChannel(channel); supabase.removeChannel(dbChannel); cleanup(); };
  }, [roomId, user?.id, enabled]);

  return {
    isStreaming: state.isStreaming, isReceiving: state.isReceiving,
    connectionState: state.connectionState, streamerId: state.streamerId,
    remoteStream, remoteVideoRef,
    startStreaming, stopStreaming, toggleStreaming, cleanup
  };
};
