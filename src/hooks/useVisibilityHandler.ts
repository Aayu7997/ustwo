import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

/**
 * Handles browser visibility changes to maintain stable connections
 * Prevents disconnects when user switches tabs or minimizes browser
 */
export const useVisibilityHandler = (roomId: string) => {
  const { user } = useAuth();
  const lastHiddenTimeRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<any>(null);

  // Ping presence to keep connections alive
  const pingPresence = useCallback(async () => {
    if (!roomId || !user?.id) return;
    
    try {
      // Send a heartbeat to indicate we're still here
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'heartbeat',
          payload: {
            userId: user.id,
            timestamp: Date.now()
          }
        });
      }
    } catch (error) {
      console.log('[Visibility] Heartbeat failed:', error);
    }
  }, [roomId, user?.id]);

  // Handle visibility change
  const handleVisibilityChange = useCallback(() => {
    if (document.hidden) {
      // Page is now hidden - store the timestamp
      lastHiddenTimeRef.current = Date.now();
      console.log('[Visibility] Page hidden');
    } else {
      // Page is now visible again
      const hiddenDuration = Date.now() - lastHiddenTimeRef.current;
      console.log('[Visibility] Page visible again, was hidden for:', hiddenDuration, 'ms');

      // Clear any pending reconnect
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // If hidden for more than 10 seconds, send a presence ping
      if (hiddenDuration > 10000) {
        pingPresence();
      }

      // If hidden for more than 5 minutes, suggest reconnect (but don't force reload)
      if (hiddenDuration > 300000) {
        console.log('[Visibility] Long absence detected, refreshing presence');
        pingPresence();
      }
    }
  }, [pingPresence]);

  // Handle beforeunload to clean up gracefully
  const handleBeforeUnload = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'user_leaving',
        payload: { userId: user?.id }
      }).catch(() => {});
    }
  }, [user?.id]);

  // Set up visibility listeners
  useEffect(() => {
    if (!roomId || !user?.id) return;

    // Create presence channel
    const channel = supabase
      .channel(`presence_${roomId}`)
      .on('broadcast', { event: 'heartbeat' }, () => {
        // Just acknowledge heartbeats
      })
      .subscribe();

    channelRef.current = channel;

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Periodic heartbeat every 30 seconds when visible
    const heartbeatInterval = setInterval(() => {
      if (!document.hidden) {
        pingPresence();
      }
    }, 30000);

    // Initial ping
    pingPresence();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearInterval(heartbeatInterval);
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [roomId, user?.id, handleVisibilityChange, handleBeforeUnload, pingPresence]);

  return {
    pingPresence
  };
};
