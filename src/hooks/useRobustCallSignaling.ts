import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

// Database status values vs UI status values
type DbCallStatus = 'calling' | 'ringing' | 'accepted' | 'rejected' | 'ended' | 'missed';
export type CallStatus = 'idle' | 'calling' | 'ringing' | 'connecting' | 'connected' | 'ended' | 'rejected' | 'missed';

export interface CallData {
  id: string;
  roomId: string;
  callerId: string;
  receiverId: string;
  status: CallStatus;
  callType: 'video' | 'audio';
  offer?: any;
  answer?: any;
  createdAt: string;
}

interface UseRobustCallSignalingProps {
  roomId: string;
  partnerId?: string | null;
}

const CALL_TIMEOUT = 30000; // 30 seconds

export const useRobustCallSignaling = ({ roomId, partnerId }: UseRobustCallSignalingProps) => {
  const { user } = useAuth();
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [activeCall, setActiveCall] = useState<CallData | null>(null);
  const [incomingCall, setIncomingCall] = useState<CallData | null>(null);
  const callTimeoutRef = useRef<number | null>(null);
  const channelRef = useRef<any>(null);

  // Clear timeout
  const clearCallTimeout = useCallback(() => {
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
  }, []);

  // Initiate a call
  const initiateCall = useCallback(async (callType: 'video' | 'audio' = 'video') => {
    if (!user?.id || !partnerId || !roomId) {
      toast({
        title: 'Cannot start call',
        description: 'Partner not available',
        variant: 'destructive'
      });
      return null;
    }

    try {
      setCallStatus('calling');

      // Insert call record into database
      const { data: call, error } = await supabase
        .from('calls')
        .insert({
          room_id: roomId,
          caller_id: user.id,
          receiver_id: partnerId,
          status: 'calling',
          call_type: callType
        })
        .select()
        .single();

      if (error) throw error;

      const callData: CallData = {
        id: call.id,
        roomId: call.room_id,
        callerId: call.caller_id,
        receiverId: call.receiver_id,
        status: call.status as CallStatus,
        callType: call.call_type as 'video' | 'audio',
        createdAt: call.created_at
      };

      setActiveCall(callData);

      // Also broadcast via realtime for instant notification
      if (channelRef.current) {
        await channelRef.current.send({
          type: 'broadcast',
          event: 'incoming_call',
          payload: callData
        });
      }

      // Set timeout for unanswered call
      callTimeoutRef.current = window.setTimeout(async () => {
        if (callStatus === 'calling') {
          await updateCallStatus(call.id, 'missed');
          setCallStatus('idle');
          setActiveCall(null);
          toast({
            title: 'Call not answered',
            description: 'Your partner did not pick up'
          });
        }
      }, CALL_TIMEOUT);

      toast({
        title: callType === 'video' ? 'Video call started' : 'Voice call started',
        description: 'Waiting for partner to answer...'
      });

      return callData;
    } catch (error) {
      console.error('[CallSignaling] Failed to initiate call:', error);
      setCallStatus('idle');
      toast({
        title: 'Call failed',
        description: 'Could not start the call',
        variant: 'destructive'
      });
      return null;
    }
  }, [user?.id, partnerId, roomId, callStatus]);

  // Update call status in database
  const updateCallStatus = useCallback(async (callId: string, status: CallStatus) => {
    try {
      const updateData: any = { status };
      
      if (status === 'connected') {
        updateData.started_at = new Date().toISOString();
      } else if (status === 'ended') {
        updateData.ended_at = new Date().toISOString();
      }

      await supabase
        .from('calls')
        .update(updateData)
        .eq('id', callId);

      // Broadcast status change
      if (channelRef.current) {
        await channelRef.current.send({
          type: 'broadcast',
          event: 'call_status_change',
          payload: { callId, status }
        });
      }
    } catch (error) {
      console.error('[CallSignaling] Failed to update call status:', error);
    }
  }, []);

  // Accept incoming call
  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;

    clearCallTimeout();
    setCallStatus('connecting');
    setActiveCall(incomingCall);
    setIncomingCall(null);

    // Update DB with 'accepted' status (maps to 'connecting' in UI)
    await supabase
      .from('calls')
      .update({ status: 'accepted' as DbCallStatus })
      .eq('id', incomingCall.id);

    toast({
      title: 'Call accepted',
      description: 'Connecting...'
    });
  }, [incomingCall, clearCallTimeout, updateCallStatus]);

  // Reject incoming call
  const rejectCall = useCallback(async () => {
    if (!incomingCall) return;

    clearCallTimeout();
    await updateCallStatus(incomingCall.id, 'rejected');
    
    setIncomingCall(null);
    setCallStatus('idle');

    toast({
      title: 'Call rejected'
    });
  }, [incomingCall, clearCallTimeout, updateCallStatus]);

  // Cancel outgoing call
  const cancelCall = useCallback(async () => {
    if (!activeCall) return;

    clearCallTimeout();
    await updateCallStatus(activeCall.id, 'ended');
    
    setActiveCall(null);
    setCallStatus('idle');

    toast({
      title: 'Call cancelled'
    });
  }, [activeCall, clearCallTimeout, updateCallStatus]);

  // End active call
  const endCall = useCallback(async () => {
    if (!activeCall) return;

    clearCallTimeout();
    
    // Calculate duration if call was connected
    const duration = activeCall.createdAt
      ? Math.floor((Date.now() - new Date(activeCall.createdAt).getTime()) / 1000)
      : 0;

    try {
      await supabase
        .from('calls')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
          duration_seconds: duration
        })
        .eq('id', activeCall.id);
    } catch (error) {
      console.error('[CallSignaling] Failed to end call:', error);
    }

    // Broadcast end
    if (channelRef.current) {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'call_ended',
        payload: { callId: activeCall.id }
      });
    }

    setActiveCall(null);
    setCallStatus('idle');

    toast({
      title: 'Call ended',
      description: duration > 0 ? `Duration: ${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}` : undefined
    });
  }, [activeCall, clearCallTimeout]);

  // Mark call as connected
  const markConnected = useCallback(async () => {
    if (!activeCall) return;
    
    setCallStatus('connected');
    await updateCallStatus(activeCall.id, 'connected');
  }, [activeCall, updateCallStatus]);

  // Store WebRTC offer
  const storeOffer = useCallback(async (offer: any) => {
    if (!activeCall) return;

    try {
      await supabase
        .from('calls')
        .update({ offer })
        .eq('id', activeCall.id);
    } catch (error) {
      console.error('[CallSignaling] Failed to store offer:', error);
    }
  }, [activeCall]);

  // Store WebRTC answer
  const storeAnswer = useCallback(async (answer: any) => {
    if (!activeCall) return;

    try {
      await supabase
        .from('calls')
        .update({ answer })
        .eq('id', activeCall.id);
    } catch (error) {
      console.error('[CallSignaling] Failed to store answer:', error);
    }
  }, [activeCall]);

  // Subscribe to call events
  useEffect(() => {
    if (!roomId || !user?.id) return;

    console.log('[CallSignaling] Setting up subscriptions for room:', roomId);

    // Broadcast channel for instant notifications
    const broadcastChannel = supabase
      .channel(`calls_broadcast_${roomId}`)
      .on('broadcast', { event: 'incoming_call' }, (payload) => {
        const call = payload.payload as CallData;
        
        // Ignore our own calls
        if (call.callerId === user.id) return;
        
        // Ignore if we're already in a call
        if (callStatus !== 'idle') return;

        console.log('[CallSignaling] Incoming call:', call);
        
        setIncomingCall(call);
        setCallStatus('ringing');

        // Play notification sound if available
        try {
          const audio = new Audio('/call-ringtone.mp3');
          audio.volume = 0.5;
          audio.play().catch(() => {});
        } catch {}
      })
      .on('broadcast', { event: 'call_status_change' }, (payload) => {
        const { callId, status } = payload.payload;
        
        if (activeCall?.id === callId || incomingCall?.id === callId) {
          console.log('[CallSignaling] Call status changed:', status);
          
          if (status === 'accepted' && callStatus === 'calling') {
            clearCallTimeout();
            setCallStatus('connecting');
          } else if (status === 'rejected') {
            clearCallTimeout();
            setCallStatus('idle');
            setActiveCall(null);
            toast({
              title: 'Call declined',
              description: 'Your partner declined the call'
            });
          }
        }
      })
      .on('broadcast', { event: 'call_ended' }, (payload) => {
        const { callId } = payload.payload;
        
        if (activeCall?.id === callId) {
          clearCallTimeout();
          setCallStatus('idle');
          setActiveCall(null);
          toast({
            title: 'Call ended',
            description: 'Your partner ended the call'
          });
        }
      })
      .subscribe();

    channelRef.current = broadcastChannel;

    // Database subscription for reliability
    const dbChannel = supabase
      .channel(`calls_db_${roomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'calls',
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        const call = payload.new as any;
        if (!call) return;

        // Handle incoming calls (in case broadcast was missed)
        if (
          payload.eventType === 'INSERT' &&
          call.receiver_id === user.id &&
          call.status === 'calling' &&
          callStatus === 'idle'
        ) {
          const callData: CallData = {
            id: call.id,
            roomId: call.room_id,
            callerId: call.caller_id,
            receiverId: call.receiver_id,
            status: call.status,
            callType: call.call_type,
            createdAt: call.created_at
          };

          console.log('[CallSignaling] DB: Incoming call detected');
          setIncomingCall(callData);
          setCallStatus('ringing');
        }

        // Handle status updates
        if (payload.eventType === 'UPDATE') {
          if (activeCall?.id === call.id) {
            if (call.status === 'accepted' && callStatus === 'calling') {
              clearCallTimeout();
              setCallStatus('connecting');
            } else if (call.status === 'rejected' || call.status === 'ended') {
              clearCallTimeout();
              setCallStatus('idle');
              setActiveCall(null);
            }
          }
        }
      })
      .subscribe();

    return () => {
      clearCallTimeout();
      supabase.removeChannel(broadcastChannel);
      supabase.removeChannel(dbChannel);
    };
  }, [roomId, user?.id, callStatus, activeCall, incomingCall, clearCallTimeout]);

  // Check for existing incoming calls on mount
  useEffect(() => {
    if (!roomId || !user?.id || callStatus !== 'idle') return;

    const checkPendingCalls = async () => {
      try {
        const { data: calls } = await supabase
          .from('calls')
          .select('*')
          .eq('room_id', roomId)
          .eq('receiver_id', user.id)
          .eq('status', 'calling')
          .order('created_at', { ascending: false })
          .limit(1);

        if (calls && calls.length > 0) {
          const call = calls[0];
          const callAge = Date.now() - new Date(call.created_at).getTime();
          
          // Only show if call is less than 30 seconds old
          if (callAge < CALL_TIMEOUT) {
            const callData: CallData = {
              id: call.id,
              roomId: call.room_id,
              callerId: call.caller_id,
              receiverId: call.receiver_id,
              status: call.status as CallStatus,
              callType: call.call_type as 'video' | 'audio',
              createdAt: call.created_at
            };

            console.log('[CallSignaling] Found pending call');
            setIncomingCall(callData);
            setCallStatus('ringing');
          }
        }
      } catch (error) {
        console.error('[CallSignaling] Failed to check pending calls:', error);
      }
    };

    checkPendingCalls();
  }, [roomId, user?.id, callStatus]);

  return {
    callStatus,
    activeCall,
    incomingCall,
    activeCallId: activeCall?.id || null,
    
    // Actions
    initiateCall,
    acceptCall,
    rejectCall,
    cancelCall,
    endCall,
    markConnected,
    storeOffer,
    storeAnswer
  };
};
