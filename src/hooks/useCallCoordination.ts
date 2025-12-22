import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface CallSession {
  callId: string;
  startedBy: string;
  startedAt: number;
}

interface UseCallCoordinationProps {
  roomId: string;
  enabled: boolean;
}

export const useCallCoordination = ({ roomId, enabled }: UseCallCoordinationProps) => {
  const { user } = useAuth();
  const [currentCall, setCurrentCall] = useState<CallSession | null>(null);
  const [isInitiator, setIsInitiator] = useState(false);
  const channelRef = useRef<any>(null);
  const callIdRef = useRef<string | null>(null);

  // Generate unique call ID
  const generateCallId = useCallback(() => {
    return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Start a new call session
  const startCallSession = useCallback(async (): Promise<string | null> => {
    if (!user) return null;

    const callId = generateCallId();
    callIdRef.current = callId;

    const session: CallSession = {
      callId,
      startedBy: user.id,
      startedAt: Date.now()
    };

    setCurrentCall(session);
    setIsInitiator(true);

    // Broadcast call started
    if (channelRef.current) {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'call_started',
        payload: session
      });
    }

    console.log('[CallCoord] Started call session:', callId);
    return callId;
  }, [user, generateCallId]);

  // Join existing call session
  const joinCallSession = useCallback((session: CallSession) => {
    if (!user) return;

    callIdRef.current = session.callId;
    setCurrentCall(session);
    
    // User who didn't start is not initiator
    setIsInitiator(session.startedBy === user.id);

    console.log('[CallCoord] Joined call session:', session.callId);
  }, [user]);

  // End call session
  const endCallSession = useCallback(async () => {
    if (!callIdRef.current) return;

    // Broadcast call ended
    if (channelRef.current) {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'call_ended',
        payload: { callId: callIdRef.current }
      });
    }

    console.log('[CallCoord] Ended call session:', callIdRef.current);
    
    callIdRef.current = null;
    setCurrentCall(null);
    setIsInitiator(false);
  }, []);

  // Check if signal belongs to current call
  const isValidSignal = useCallback((signalCallId: string): boolean => {
    return callIdRef.current === signalCallId;
  }, []);

  // Determine initiator role (deterministic: smaller user ID is initiator if conflicting)
  const shouldBeInitiator = useCallback((otherUserId: string): boolean => {
    if (!user) return false;
    return user.id < otherUserId;
  }, [user]);

  // Clear stale signals for this room
  const clearStaleSignals = useCallback(async () => {
    if (!roomId) return;

    // Delete signals older than 30 seconds
    const cutoff = new Date(Date.now() - 30000).toISOString();
    
    try {
      await supabase
        .from('rtc_signaling')
        .delete()
        .eq('room_id', roomId)
        .lt('created_at', cutoff);
      
      console.log('[CallCoord] Cleared stale signals');
    } catch (error) {
      console.error('[CallCoord] Failed to clear signals:', error);
    }
  }, [roomId]);

  // Subscribe to call coordination events
  useEffect(() => {
    if (!roomId || !enabled) return;

    const channel = supabase
      .channel(`call_coord_${roomId}`)
      .on('broadcast', { event: 'call_started' }, (payload) => {
        const session = payload.payload as CallSession;
        
        if (session.startedBy === user?.id) return;
        
        // If we don't have a call, join this one
        if (!callIdRef.current) {
          joinCallSession(session);
        } else if (session.startedBy && user?.id) {
          // Conflict resolution: lower user ID wins
          if (shouldBeInitiator(session.startedBy)) {
            // Keep our call, ignore theirs
            console.log('[CallCoord] Ignoring conflicting call, we are initiator');
          } else {
            // Their call wins, join it
            console.log('[CallCoord] Accepting their call, they are initiator');
            joinCallSession(session);
          }
        }
      })
      .on('broadcast', { event: 'call_ended' }, (payload) => {
        const { callId } = payload.payload as { callId: string };
        
        if (callIdRef.current === callId) {
          console.log('[CallCoord] Partner ended call');
          callIdRef.current = null;
          setCurrentCall(null);
          setIsInitiator(false);
        }
      })
      .subscribe();

    channelRef.current = channel;

    // Clear stale signals on mount
    clearStaleSignals();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, enabled, user?.id, joinCallSession, shouldBeInitiator, clearStaleSignals]);

  return {
    currentCall,
    isInitiator,
    callId: callIdRef.current,
    startCallSession,
    joinCallSession,
    endCallSession,
    isValidSignal,
    clearStaleSignals
  };
};
