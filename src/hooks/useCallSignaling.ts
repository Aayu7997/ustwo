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

interface UseCallSignalingProps {
  roomId: string;
  partnerId?: string | null;
}

export const useCallSignaling = ({ roomId, partnerId }: UseCallSignalingProps) => {
  const { user } = useAuth();
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [incomingCall, setIncomingCall] = useState<CallSignal | null>(null);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const channelRef = useRef<any>(null);
  const callTimeoutRef = useRef<number | null>(null);
  const callIdRef = useRef<string | null>(null);
  const CALL_TIMEOUT = 30000; // 30 seconds

  // Generate unique call ID
  const generateCallId = useCallback(() => {
    return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Clear timeout
  const clearCallTimeout = useCallback(() => {
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
  }, []);

  // Initiate a call
  const initiateCall = useCallback(async (callType: 'video' | 'voice' = 'video') => {
    if (!user || !partnerId || callStatus !== 'idle') {
      console.log('[CallSignaling] Cannot initiate call:', { user: !!user, partnerId, callStatus });
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

    // Broadcast call initiation
    if (channelRef.current) {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'call_initiated',
        payload: signal
      });
    }

    // Also store in rtc_signaling for persistence
    try {
      await supabase.from('rtc_signaling').insert([{
        room_id: roomId,
        room_code: roomId.substring(0, 6),
        sender: user.id,
        type: 'call_signal',
        payload: signal as any
      }]);
    } catch (error) {
      console.error('[CallSignaling] Failed to store signal:', error);
    }

    console.log('[CallSignaling] Call initiated:', callId);

    // Set timeout for unanswered call
    const currentCallId = callId;
    callTimeoutRef.current = window.setTimeout(() => {
      if (callIdRef.current === currentCallId) {
        cancelCall();
        toast({
          title: 'No Answer',
          description: 'Your partner did not answer the call',
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

    console.log('[CallSignaling] Call accepted:', incomingCall.id);
    setIncomingCall(null);
  }, [incomingCall, user, clearCallTimeout]);

  // Reject incoming call
  const rejectCall = useCallback(async () => {
    if (!incomingCall || !user) return;

    clearCallTimeout();

    // Broadcast rejection
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

    console.log('[CallSignaling] Call rejected:', incomingCall.id);
    setIncomingCall(null);
    setCallStatus('idle');
    setActiveCallId(null);
  }, [incomingCall, user, clearCallTimeout]);

  // Cancel outgoing call
  const cancelCall = useCallback(async () => {
    if (!activeCallId || !user) return;

    clearCallTimeout();

    // Broadcast cancellation
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

    console.log('[CallSignaling] Call cancelled:', activeCallId);
    setCallStatus('idle');
    setActiveCallId(null);
  }, [activeCallId, user, clearCallTimeout]);

  // End active call
  const endCall = useCallback(async () => {
    if (!activeCallId || !user) return;

    clearCallTimeout();

    // Broadcast end
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

    console.log('[CallSignaling] Call ended:', activeCallId);
    setCallStatus('ended');
    
    // Reset to idle after brief delay
    setTimeout(() => {
      setCallStatus('idle');
      setActiveCallId(null);
    }, 500);
  }, [activeCallId, user, clearCallTimeout]);

  // Mark as connected
  const markConnected = useCallback(() => {
    clearCallTimeout();
    setCallStatus('connected');
    console.log('[CallSignaling] Call connected');
  }, [clearCallTimeout]);

  // Subscribe to call signals
  useEffect(() => {
    if (!roomId || !user) return;

    const channel = supabase
      .channel(`call_signaling_${roomId}`)
      .on('broadcast', { event: 'call_initiated' }, ({ payload }) => {
        const signal = payload as CallSignal;
        
        // Ignore our own calls
        if (signal.callerId === user.id) return;
        
        // Only show if we're the receiver
        if (signal.receiverId !== user.id) return;
        
        console.log('[CallSignaling] Incoming call:', signal);
        
        // Show incoming call
        setIncomingCall(signal);
        setCallStatus('incoming');
        
        // Play notification sound
        try {
          const audio = new Audio('/notification.mp3');
          audio.volume = 0.5;
          audio.play().catch(() => {});
        } catch {}
        
        // Auto-timeout incoming call
        callTimeoutRef.current = window.setTimeout(() => {
          if (callStatus === 'incoming') {
            setIncomingCall(null);
            setCallStatus('idle');
          }
        }, CALL_TIMEOUT);
      })
      .on('broadcast', { event: 'call_accepted' }, ({ payload }) => {
        const { callId, acceptedBy } = payload;
        
        if (callId !== activeCallId) return;
        if (acceptedBy === user.id) return;
        
        console.log('[CallSignaling] Call accepted by partner');
        clearCallTimeout();
        setCallStatus('connecting');
      })
      .on('broadcast', { event: 'call_rejected' }, ({ payload }) => {
        const { callId, rejectedBy } = payload;
        
        if (callId !== activeCallId) return;
        if (rejectedBy === user.id) return;
        
        console.log('[CallSignaling] Call rejected by partner');
        clearCallTimeout();
        setCallStatus('idle');
        setActiveCallId(null);
        
        toast({
          title: 'Call Declined',
          description: 'Your partner declined the call',
        });
      })
      .on('broadcast', { event: 'call_cancelled' }, ({ payload }) => {
        const { callId, cancelledBy } = payload;
        
        if (cancelledBy === user.id) return;
        
        console.log('[CallSignaling] Call cancelled by caller');
        clearCallTimeout();
        setIncomingCall(null);
        setCallStatus('idle');
        setActiveCallId(null);
      })
      .on('broadcast', { event: 'call_ended' }, ({ payload }) => {
        const { callId, endedBy } = payload;
        
        if (endedBy === user.id) return;
        
        console.log('[CallSignaling] Call ended by partner');
        clearCallTimeout();
        setCallStatus('ended');
        setActiveCallId(null);
        
        setTimeout(() => setCallStatus('idle'), 500);
        
        toast({
          title: 'Call Ended',
          description: 'Your partner ended the call',
        });
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      clearCallTimeout();
      supabase.removeChannel(channel);
    };
  }, [roomId, user, activeCallId, callStatus, clearCallTimeout]);

  return {
    callStatus,
    incomingCall,
    activeCallId,
    initiateCall,
    acceptCall,
    rejectCall,
    cancelCall,
    endCall,
    markConnected
  };
};
