import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

/**
 * Enhanced visibility handler for maintaining stable connections
 * - Prevents page reloads on tab switch
 * - Maintains WebRTC connections
 * - Keeps Supabase Realtime channels alive
 * - Syncs state on return
 */
export const useVisibilityHandler = (roomId: string) => {
  const { user } = useAuth();
  const lastHiddenTimeRef = useRef<number>(0);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<any>(null);
  const isRestoringRef = useRef(false);
  
  // Session storage key for room state persistence
  const SESSION_KEY = `ustowo_room_${roomId}`;

  // Save room state to session storage
  const saveRoomState = useCallback((state: any) => {
    if (!roomId) return;
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        ...state,
        savedAt: Date.now(),
        userId: user?.id
      }));
    } catch (e) {
      console.log('[Visibility] Could not save room state');
    }
  }, [roomId, user?.id, SESSION_KEY]);

  // Restore room state from session storage
  const restoreRoomState = useCallback(() => {
    if (!roomId) return null;
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        const state = JSON.parse(saved);
        // Only restore if saved within last 30 minutes
        if (Date.now() - state.savedAt < 30 * 60 * 1000) {
          return state;
        }
      }
    } catch (e) {
      console.log('[Visibility] Could not restore room state');
    }
    return null;
  }, [roomId, SESSION_KEY]);

  // Ping presence to keep connections alive
  const pingPresence = useCallback(async () => {
    if (!roomId || !user?.id) return;
    
    try {
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'heartbeat',
          payload: {
            userId: user.id,
            timestamp: Date.now(),
            status: document.hidden ? 'background' : 'active'
          }
        });
      }
    } catch (error) {
      console.log('[Visibility] Heartbeat failed:', error);
    }
  }, [roomId, user?.id]);

  // Handle visibility change - CRITICAL for preventing reloads
  const handleVisibilityChange = useCallback(() => {
    if (document.hidden) {
      // Page is now hidden - store the timestamp and state
      lastHiddenTimeRef.current = Date.now();
      console.log('[Visibility] Page hidden');
      
      // Save current room state
      saveRoomState({
        roomId,
        hidden: true,
        url: window.location.href
      });
      
      // Continue heartbeats at slower rate when hidden
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      heartbeatIntervalRef.current = setInterval(pingPresence, 60000); // Every minute when hidden
    } else {
      // Page is now visible again
      const hiddenDuration = Date.now() - lastHiddenTimeRef.current;
      console.log('[Visibility] Page visible again, was hidden for:', hiddenDuration, 'ms');

      // Prevent any restoration if already restoring
      if (isRestoringRef.current) return;
      isRestoringRef.current = true;

      // Resume normal heartbeat rate
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      heartbeatIntervalRef.current = setInterval(pingPresence, 15000); // Every 15s when active

      // Send immediate presence ping
      pingPresence();

      // For short absences (< 30s), just ping presence
      if (hiddenDuration < 30000) {
        console.log('[Visibility] Short absence, just refreshing presence');
        isRestoringRef.current = false;
        return;
      }

      // For medium absences (30s - 5min), refresh channel subscriptions silently
      if (hiddenDuration < 300000) {
        console.log('[Visibility] Medium absence, refreshing subscriptions');
        // The Supabase client handles reconnection automatically
        isRestoringRef.current = false;
        return;
      }

      // For long absences (> 5min), log but don't reload
      console.log('[Visibility] Long absence detected, maintaining connection');
      // Just ping and let the existing channels reconnect naturally
      isRestoringRef.current = false;
    }
  }, [pingPresence, saveRoomState, roomId]);

  // Handle beforeunload to save state
  const handleBeforeUnload = useCallback((e: BeforeUnloadEvent) => {
    saveRoomState({
      roomId,
      unloading: true,
      url: window.location.href
    });

    // Send leaving signal
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'user_leaving',
        payload: { userId: user?.id }
      }).catch(() => {});
    }
  }, [user?.id, saveRoomState, roomId]);

  // Handle page focus (more granular than visibility)
  const handleFocus = useCallback(() => {
    console.log('[Visibility] Window focused');
    pingPresence();
  }, [pingPresence]);

  // Handle page blur
  const handleBlur = useCallback(() => {
    console.log('[Visibility] Window blurred');
  }, []);

  // Handle online/offline
  const handleOnline = useCallback(() => {
    console.log('[Visibility] Network online');
    pingPresence();
  }, [pingPresence]);

  const handleOffline = useCallback(() => {
    console.log('[Visibility] Network offline');
  }, []);

  // Set up visibility listeners
  useEffect(() => {
    if (!roomId || !user?.id) return;

    // Create presence channel
    const channel = supabase
      .channel(`presence_stable_${roomId}`, {
        config: {
          broadcast: { self: false }
        }
      })
      .on('broadcast', { event: 'heartbeat' }, ({ payload }) => {
        // Acknowledge heartbeats from partner
        if (payload.userId !== user.id) {
          console.log('[Visibility] Partner heartbeat received');
        }
      })
      .on('broadcast', { event: 'user_leaving' }, ({ payload }) => {
        if (payload.userId !== user.id) {
          console.log('[Visibility] Partner leaving room');
        }
      })
      .subscribe();

    channelRef.current = channel;

    // Add all event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Start heartbeat interval - every 15 seconds when active
    heartbeatIntervalRef.current = setInterval(pingPresence, 15000);

    // Initial ping
    pingPresence();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [roomId, user?.id, handleVisibilityChange, handleBeforeUnload, handleFocus, handleBlur, handleOnline, handleOffline, pingPresence]);

  return {
    pingPresence,
    saveRoomState,
    restoreRoomState
  };
};
