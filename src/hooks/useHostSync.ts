import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface SyncState {
  status: 'play' | 'pause';
  currentTime: number;
  playbackRate: number;
  sourceType: 'youtube' | 'local' | 'url' | 'vimeo' | 'hls' | 'stream';
  sourceUrl: string;
  updatedAt: number;
  hostId: string;
}

interface UseHostSyncProps {
  roomId: string;
  roomCode?: string;
  isHost: boolean;
  onSyncReceived?: (state: SyncState) => void;
}

// SYNC RULES:
// - When host presses play → broadcast state
// - Listener receives state → force sync
// - If time diff > 1s → auto seek
// - If paused → pause for all
// - If resumed → resume for all
// - Every 2s → re-sync time

const SYNC_INTERVAL = 2000; // 2 seconds
const DRIFT_THRESHOLD = 1.0; // 1 second

export const useHostSync = ({ roomId, roomCode, isHost, onSyncReceived }: UseHostSyncProps) => {
  const { user } = useAuth();
  const channelRef = useRef<any>(null);
  const syncIntervalRef = useRef<number | null>(null);
  const lastSyncRef = useRef<SyncState | null>(null);
  const [currentHostId, setCurrentHostId] = useState<string | null>(null);

  // Initialize channel
  useEffect(() => {
    if (!roomId || !user?.id) return;

    const channel = supabase
      .channel(`host_sync_${roomId}`, {
        config: { broadcast: { self: false } }
      })
      .on('broadcast', { event: 'sync_state' }, (payload) => {
        const state = payload.payload as SyncState;
        
        // Skip own messages
        if (state.hostId === user.id) return;
        
        // Only listeners should apply sync
        if (isHost) return;
        
        console.log('[HostSync] Received sync from host:', {
          time: state.currentTime.toFixed(1),
          status: state.status
        });
        
        lastSyncRef.current = state;
        onSyncReceived?.(state);
      })
      .on('broadcast', { event: 'host_change' }, (payload) => {
        const { hostId } = payload.payload;
        console.log('[HostSync] Host changed to:', hostId);
        setCurrentHostId(hostId);
      })
      .subscribe();

    channelRef.current = channel;

    // Announce as host if we are
    if (isHost) {
      channel.send({
        type: 'broadcast',
        event: 'host_change',
        payload: { hostId: user.id }
      });
      setCurrentHostId(user.id);
    }

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [roomId, user?.id, isHost, onSyncReceived]);

  // Broadcast sync state (host only)
  const broadcastSync = useCallback(async (state: Omit<SyncState, 'hostId' | 'updatedAt'>) => {
    if (!channelRef.current || !user?.id || !isHost) return;

    const fullState: SyncState = {
      ...state,
      hostId: user.id,
      updatedAt: Date.now()
    };

    console.log('[HostSync] Broadcasting:', {
      status: state.status,
      time: state.currentTime.toFixed(1)
    });

    try {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'sync_state',
        payload: fullState
      });

      // Also persist to database for late joiners
      await supabase
        .from('playback_state')
        .upsert({
          room_id: roomId,
          current_time_seconds: state.currentTime,
          is_playing: state.status === 'play',
          last_updated_by: user.id,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'room_id',
          ignoreDuplicates: false
        });
    } catch (error) {
      console.error('[HostSync] Broadcast failed:', error);
    }
  }, [user?.id, isHost, roomId]);

  // Start periodic sync (host only)
  const startPeriodicSync = useCallback((getState: () => Omit<SyncState, 'hostId' | 'updatedAt'>) => {
    if (!isHost) return;
    
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
    }

    // Initial sync
    broadcastSync(getState());

    // Periodic sync every 2 seconds
    syncIntervalRef.current = window.setInterval(() => {
      const state = getState();
      if (state.status === 'play') {
        broadcastSync(state);
      }
    }, SYNC_INTERVAL);
  }, [isHost, broadcastSync]);

  // Stop periodic sync
  const stopPeriodicSync = useCallback(() => {
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
  }, []);

  // Calculate if listener needs to seek (drift > 1s)
  const shouldSeek = useCallback((localTime: number, remoteTime: number): boolean => {
    return Math.abs(localTime - remoteTime) > DRIFT_THRESHOLD;
  }, []);

  // Fetch initial state for late joiners
  const fetchInitialState = useCallback(async (): Promise<SyncState | null> => {
    try {
      const [roomRes, playbackRes] = await Promise.all([
        supabase
          .from('rooms')
          .select('current_media_url, current_media_type, creator_id')
          .eq('id', roomId)
          .single(),
        supabase
          .from('playback_state')
          .select('*')
          .eq('room_id', roomId)
          .maybeSingle()
      ]);

      if (!playbackRes.data) return null;

      return {
        status: playbackRes.data.is_playing ? 'play' : 'pause',
        currentTime: playbackRes.data.current_time_seconds || 0,
        playbackRate: 1,
        sourceType: (roomRes.data?.current_media_type as any) || 'local',
        sourceUrl: roomRes.data?.current_media_url || '',
        updatedAt: new Date(playbackRes.data.updated_at).getTime(),
        hostId: playbackRes.data.last_updated_by || roomRes.data?.creator_id || ''
      };
    } catch (error) {
      console.error('[HostSync] Failed to fetch initial state:', error);
      return null;
    }
  }, [roomId]);

  return {
    currentHostId,
    isHost,
    broadcastSync,
    startPeriodicSync,
    stopPeriodicSync,
    shouldSeek,
    fetchInitialState,
    lastSync: lastSyncRef.current,
    DRIFT_THRESHOLD,
    SYNC_INTERVAL
  };
};
