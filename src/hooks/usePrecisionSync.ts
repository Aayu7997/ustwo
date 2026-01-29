import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface SyncState {
  status: 'play' | 'pause' | 'buffering';
  currentTime: number;
  playbackRate: number;
  sourceType: 'youtube' | 'local' | 'url' | 'vimeo' | 'hls' | 'stream';
  sourceUrl: string;
  updatedAt: number;
  hostId: string;
}

interface UsePrecisionSyncProps {
  roomId: string;
  isHost: boolean;
  onSyncReceived?: (state: SyncState) => void;
}

// Tighter sync parameters for production
const SYNC_INTERVAL = 1000; // 1 second heartbeat
const DRIFT_THRESHOLD = 0.8; // 0.8 second drift tolerance
const BUFFER_THRESHOLD = 2.0; // 2 seconds for buffering detection

export const usePrecisionSync = ({ roomId, isHost, onSyncReceived }: UsePrecisionSyncProps) => {
  const { user } = useAuth();
  const channelRef = useRef<any>(null);
  const syncIntervalRef = useRef<number | null>(null);
  const lastSyncRef = useRef<SyncState | null>(null);
  const pendingSyncRef = useRef<SyncState | null>(null);
  const playerReadyRef = useRef(false);

  const [currentHostId, setCurrentHostId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'out_of_sync'>('synced');

  // Mark player as ready
  const markPlayerReady = useCallback(() => {
    playerReadyRef.current = true;
    
    // Apply pending sync if exists
    if (pendingSyncRef.current && !isHost) {
      console.log('[Sync] Applying pending sync');
      onSyncReceived?.(pendingSyncRef.current);
      pendingSyncRef.current = null;
    }
  }, [isHost, onSyncReceived]);

  // Initialize channel
  useEffect(() => {
    if (!roomId || !user?.id) return;

    console.log('[Sync] Initializing for room:', roomId, 'isHost:', isHost);

    const channel = supabase
      .channel(`precision_sync_${roomId}`, {
        config: { broadcast: { self: false } }
      })
      .on('broadcast', { event: 'sync_state' }, (payload) => {
        const state = payload.payload as SyncState;
        
        // Ignore own messages
        if (state.hostId === user.id) return;
        
        // Only followers should apply sync
        if (isHost) return;
        
        console.log('[Sync] Received:', {
          time: state.currentTime.toFixed(2),
          status: state.status
        });
        
        lastSyncRef.current = state;
        setSyncStatus('syncing');

        // Wait for player ready before applying
        if (playerReadyRef.current) {
          onSyncReceived?.(state);
          setSyncStatus('synced');
        } else {
          pendingSyncRef.current = state;
        }
      })
      .on('broadcast', { event: 'host_announce' }, (payload) => {
        const { hostId } = payload.payload;
        console.log('[Sync] Host announced:', hostId);
        setCurrentHostId(hostId);
      })
      .on('broadcast', { event: 'force_seek' }, (payload) => {
        if (isHost) return;
        
        const { time, hostId } = payload.payload;
        console.log('[Sync] Force seek to:', time);
        
        onSyncReceived?.({
          status: 'play',
          currentTime: time,
          playbackRate: 1,
          sourceType: 'local',
          sourceUrl: '',
          updatedAt: Date.now(),
          hostId
        });
      })
      .subscribe();

    channelRef.current = channel;

    // Announce as host
    if (isHost && user.id) {
      channel.send({
        type: 'broadcast',
        event: 'host_announce',
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

    console.log('[Sync] Broadcasting:', {
      status: state.status,
      time: state.currentTime.toFixed(2)
    });

    try {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'sync_state',
        payload: fullState
      });

      // Persist to database for late joiners
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
      console.error('[Sync] Broadcast failed:', error);
    }
  }, [user?.id, isHost, roomId]);

  // Force seek (for significant jumps)
  const forceSeek = useCallback(async (time: number) => {
    if (!channelRef.current || !user?.id || !isHost) return;

    console.log('[Sync] Force seek to:', time);

    await channelRef.current.send({
      type: 'broadcast',
      event: 'force_seek',
      payload: { time, hostId: user.id }
    });
  }, [user?.id, isHost]);

  // Start periodic sync (host only)
  const startPeriodicSync = useCallback((getState: () => Omit<SyncState, 'hostId' | 'updatedAt'>) => {
    if (!isHost) return;
    
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
    }

    // Initial sync
    const initialState = getState();
    broadcastSync(initialState);

    // Periodic sync every second
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

  // Calculate if follower needs to seek
  const shouldSeek = useCallback((localTime: number, remoteTime: number): boolean => {
    const drift = Math.abs(localTime - remoteTime);
    if (drift > DRIFT_THRESHOLD) {
      setSyncStatus('out_of_sync');
      return true;
    }
    setSyncStatus('synced');
    return false;
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

      const state: SyncState = {
        status: playbackRes.data.is_playing ? 'play' : 'pause',
        currentTime: playbackRes.data.current_time_seconds || 0,
        playbackRate: 1,
        sourceType: (roomRes.data?.current_media_type as any) || 'local',
        sourceUrl: roomRes.data?.current_media_url || '',
        updatedAt: new Date(playbackRes.data.updated_at).getTime(),
        hostId: playbackRes.data.last_updated_by || roomRes.data?.creator_id || ''
      };

      // Compensate for time since last update
      if (state.status === 'play') {
        const timeSinceUpdate = (Date.now() - state.updatedAt) / 1000;
        state.currentTime += timeSinceUpdate;
      }

      return state;
    } catch (error) {
      console.error('[Sync] Failed to fetch initial state:', error);
      return null;
    }
  }, [roomId]);

  return {
    currentHostId,
    isHost,
    syncStatus,
    
    // Actions
    broadcastSync,
    forceSeek,
    startPeriodicSync,
    stopPeriodicSync,
    shouldSeek,
    fetchInitialState,
    markPlayerReady,
    
    // State
    lastSync: lastSyncRef.current,
    
    // Constants
    DRIFT_THRESHOLD,
    SYNC_INTERVAL,
    BUFFER_THRESHOLD
  };
};
