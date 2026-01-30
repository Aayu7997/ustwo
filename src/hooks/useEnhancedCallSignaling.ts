import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

export type CallStatus = 'idle' | 'calling' | 'incoming' | 'connecting' | 'connected' | 'ended';

interface CallSignal {
  id: string;
  roomId: string;
  callerId: string;
  receiverId: string;
  status: CallStatus;
  callType: 'video' | 'voice';
  createdAt: number;
}

interface UseEnhancedCallSignalingProps {
  roomId: string;
  partnerId?: string | null;
}

export const useEnhancedCallSignaling = ({ roomId, partnerId }: UseEnhancedCallSignalingProps) => {
  const { user } = useAuth();
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [incomingCall, setIncomingCall] = useState<CallSignal | null>(null);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  
  const channelRef = useRef<any>(null);
  const dbChannelRef = useRef<any>(null);
  const callTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callIdRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const CALL_TIMEOUT = 30000;

  // Generate unique call ID
  const generateCallId = useCallback(() => {
    return `call_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }, []);

  // Clear timeout
  const clearCallTimeout = useCallback(() => {
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, []);

  // Play ringtone
  const playRingtone = useCallback(() => {
    try {
      // Create a simple oscillator-based ring
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.frequency.value = 440;
      gainNode.gain.value = 0.1;
      
      oscillator.start();
      
      // Ring pattern: on-off-on-off
      const stopTime = audioCtx.currentTime + 1;
      oscillator.stop(stopTime);
      
      // Store for cleanup
      setTimeout(() => {
        audioCtx.close().catch(() => {});
      }, 1100);
    } catch (e) {
      console.log('[CallSignaling] Could not play ringtone');
    }
  }, []);

  // Initiate a call
  const initiateCall = useCallback(async (callType: 'video' | 'voice' = 'video') => {
    if (!user || !partnerId || callStatus !== 'idle') {
      console.log('[CallSignaling] Cannot initiate call:', { user: !!user, partnerId, callStatus });
      if (!partnerId) {
        toast({
          title: 'No partner in room',
          description: 'Wait for your partner to join before calling',
          variant: 'destructive'
        });
      }
      return null;
    }

    const callId = generateCallId();
    callIdRef.current = callId;
    setActiveCallId(callId);
    setCallStatus('calling');

    const signal: CallSignal = {
      id: callId,
      roomId,
      callerId: user.id,
      receiverId: partnerId,
      status: 'calling',
      callType,
      createdAt: Date.now()
    };

    console.log('[CallSignaling] Initiating call:', callId);

    // Broadcast via realtime channel
    if (channelRef.current) {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'call_initiated',
        payload: signal
      });
    }

    // Also store in DB for persistence (partner might not be on the channel yet)
    try {
      await supabase.from('rtc_signaling').insert({
        room_id: roomId,
        room_code: roomId.substring(0, 6),
        sender: user.id,
        type: 'call_initiate',
        payload: signal as any
      });
    } catch (error) {
      console.error('[CallSignaling] Failed to store call signal:', error);
    }

    toast({
      title: 'Calling...',
      description: `Waiting for ${callType === 'voice' ? 'voice' : 'video'} call to be answered`
    });

    // Set timeout
    const currentCallId = callId;
    callTimeoutRef.current = setTimeout(() => {
      if (callIdRef.current === currentCallId) {
        cancelCall();
        toast({
          title: 'No Answer',
          description: 'Your partner did not answer the call'
        });
      }
    }, CALL_TIMEOUT);

    return callId;
  }, [user, partnerId, roomId, callStatus, generateCallId]);

  // Accept incoming call
  const acceptCall = useCallback(async () => {
    if (!incomingCall || !user) return;

    clearCallTimeout();
    setCallStatus('connecting');
    setActiveCallId(incomingCall.id);
    callIdRef.current = incomingCall.id;

    console.log('[CallSignaling] Accepting call:', incomingCall.id);

    // Broadcast acceptance
    if (channelRef.current) {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'call_accepted',
        payload: {
          callId: incomingCall.id,
          acceptedBy: user.id
        }
      });
    }

    // Store in DB
    try {
      await supabase.from('rtc_signaling').insert({
        room_id: roomId,
        room_code: roomId.substring(0, 6),
        sender: user.id,
        type: 'call_accept',
        payload: { callId: incomingCall.id, acceptedBy: user.id }
      });
    } catch {}

    setIncomingCall(null);
    
    toast({
      title: 'Call Accepted',
      description: 'Connecting to your partner...'
    });
  }, [incomingCall, user, roomId, clearCallTimeout]);

  // Reject incoming call
  const rejectCall = useCallback(async () => {
    if (!incomingCall || !user) return;

    clearCallTimeout();

    console.log('[CallSignaling] Rejecting call:', incomingCall.id);

    if (channelRef.current) {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'call_rejected',
        payload: {
          callId: incomingCall.id,
          rejectedBy: user.id
        }
      });
    }

    setIncomingCall(null);
    setCallStatus('idle');
    setActiveCallId(null);
    callIdRef.current = null;
  }, [incomingCall, user, clearCallTimeout]);

  // Cancel outgoing call
  const cancelCall = useCallback(async () => {
    if (!activeCallId || !user) return;

    clearCallTimeout();

    console.log('[CallSignaling] Cancelling call:', activeCallId);

    if (channelRef.current) {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'call_cancelled',
        payload: {
          callId: activeCallId,
          cancelledBy: user.id
        }
      });
    }

    setCallStatus('idle');
    setActiveCallId(null);
    callIdRef.current = null;
  }, [activeCallId, user, clearCallTimeout]);

  // End active call
  const endCall = useCallback(async () => {
    if (!activeCallId || !user) return;

    clearCallTimeout();

    console.log('[CallSignaling] Ending call:', activeCallId);

    if (channelRef.current) {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'call_ended',
        payload: {
          callId: activeCallId,
          endedBy: user.id
        }
      });
    }

    setCallStatus('ended');
    
    setTimeout(() => {
      setCallStatus('idle');
      setActiveCallId(null);
      callIdRef.current = null;
    }, 500);
  }, [activeCallId, user, clearCallTimeout]);

  // Mark as connected
  const markConnected = useCallback(() => {
    clearCallTimeout();
    setCallStatus('connected');
    console.log('[CallSignaling] Call connected');
  }, [clearCallTimeout]);

  // Handle incoming call signal
  const handleIncomingCall = useCallback((signal: CallSignal) => {
    if (signal.callerId === user?.id) return;
    if (signal.receiverId !== user?.id) return;
    if (callStatus !== 'idle') {
      console.log('[CallSignaling] Already in call, ignoring incoming');
      return;
    }

    console.log('[CallSignaling] Incoming call:', signal);
    
    setIncomingCall(signal);
    setCallStatus('incoming');
    playRingtone();

    // Auto-timeout for incoming call
    callTimeoutRef.current = setTimeout(() => {
      setIncomingCall(null);
      setCallStatus('idle');
    }, CALL_TIMEOUT);
  }, [user?.id, callStatus, playRingtone]);

  // Subscribe to call signals
  useEffect(() => {
    if (!roomId || !user) return;

    console.log('[CallSignaling] Setting up channels for room:', roomId);

    // Broadcast channel for real-time events
    const channel = supabase
      .channel(`call_signaling_${roomId}`)
      .on('broadcast', { event: 'call_initiated' }, ({ payload }) => {
        handleIncomingCall(payload as CallSignal);
      })
      .on('broadcast', { event: 'call_accepted' }, ({ payload }) => {
        const { callId, acceptedBy } = payload;
        if (callId !== callIdRef.current) return;
        if (acceptedBy === user.id) return;
        
        console.log('[CallSignaling] Partner accepted call');
        clearCallTimeout();
        setCallStatus('connecting');
      })
      .on('broadcast', { event: 'call_rejected' }, ({ payload }) => {
        const { callId, rejectedBy } = payload;
        if (callId !== callIdRef.current) return;
        if (rejectedBy === user.id) return;
        
        console.log('[CallSignaling] Partner rejected call');
        clearCallTimeout();
        setCallStatus('idle');
        setActiveCallId(null);
        callIdRef.current = null;
        
        toast({
          title: 'Call Declined',
          description: 'Your partner declined the call'
        });
      })
      .on('broadcast', { event: 'call_cancelled' }, ({ payload }) => {
        const { cancelledBy } = payload;
        if (cancelledBy === user.id) return;
        
        console.log('[CallSignaling] Caller cancelled');
        clearCallTimeout();
        setIncomingCall(null);
        setCallStatus('idle');
        setActiveCallId(null);
        callIdRef.current = null;
      })
      .on('broadcast', { event: 'call_ended' }, ({ payload }) => {
        const { endedBy } = payload;
        if (endedBy === user.id) return;
        
        console.log('[CallSignaling] Partner ended call');
        clearCallTimeout();
        setCallStatus('ended');
        
        setTimeout(() => {
          setCallStatus('idle');
          setActiveCallId(null);
          callIdRef.current = null;
        }, 500);
        
        toast({
          title: 'Call Ended',
          description: 'Your partner ended the call'
        });
      })
      .subscribe();

    channelRef.current = channel;

    // DB channel for when user just joined and might have missed broadcast
    const dbChannel = supabase
      .channel(`call_db_${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'rtc_signaling',
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        const record = payload.new;
        if (record.sender === user.id) return;
        
        if (record.type === 'call_initiate') {
          const signal = record.payload as CallSignal;
          // Only process if recent (within last 10 seconds)
          if (Date.now() - signal.createdAt < 10000) {
            handleIncomingCall(signal);
          }
        }
      })
      .subscribe();

    dbChannelRef.current = dbChannel;

    // Check for any pending calls on mount
    const checkPendingCalls = async () => {
      try {
        const { data } = await supabase
          .from('rtc_signaling')
          .select('*')
          .eq('room_id', roomId)
          .eq('type', 'call_initiate')
          .neq('sender', user.id)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (data && data.length > 0) {
          const payload = data[0].payload as unknown;
          if (payload && typeof payload === 'object' && 'id' in payload) {
            const signal = payload as CallSignal;
            // Only if recent (within last 15 seconds)
            if (Date.now() - signal.createdAt < 15000 && signal.receiverId === user.id) {
              handleIncomingCall(signal);
            }
          }
        }
      } catch {}
    };
    
    checkPendingCalls();

    return () => {
      clearCallTimeout();
      supabase.removeChannel(channel);
      supabase.removeChannel(dbChannel);
    };
  }, [roomId, user, handleIncomingCall, clearCallTimeout]);

  return {
    callStatus,
    incomingCall,
    activeCallId,
    isInitiator: callStatus === 'calling' || (callStatus === 'connecting' && !incomingCall),
    initiateCall,
    acceptCall,
    rejectCall,
    cancelCall,
    endCall,
    markConnected
  };
};
