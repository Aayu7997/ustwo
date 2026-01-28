import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type VideoSourceType = 'youtube' | 'local' | 'url' | 'vimeo' | 'hls' | 'stream';

export interface VideoState {
  sourceType: VideoSourceType;
  sourceUrl: string;
  currentTime: number;
  isPlaying: boolean;
  playbackRate: number;
  updatedAt: number;
  updatedBy: string;
}

interface UseVideoSyncProps {
  roomId: string;
  isHost: boolean;
}

export const useVideoSync = ({ roomId, isHost }: UseVideoSyncProps) => {
  const { user } = useAuth();
  const [videoState, setVideoState] = useState<VideoState | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const channelRef = useRef<any>(null);
  const syncIntervalRef = useRef<number | null>(null);
  const lastBroadcastRef = useRef<number>(0);
  
  const SYNC_INTERVAL = 2000; // 2 seconds
  const DRIFT_THRESHOLD = 1.2; // 1.2 seconds
  const MIN_BROADCAST_INTERVAL = 500; // Don't broadcast more often than 500ms

  // Broadcast state to all users
  const broadcastState = useCallback(async (state: VideoState) => {
    if (!user || !roomId) return;
    
    const now = Date.now();
    if (now - lastBroadcastRef.current < MIN_BROADCAST_INTERVAL) return;
    lastBroadcastRef.current = now;
    
    const newState: VideoState = {
      ...state,
      updatedAt: now,
      updatedBy: user.id
    };

    // Update database
    try {
      await supabase
        .from('playback_state')
        .upsert({
          room_id: roomId,
          current_time_seconds: state.currentTime,
          is_playing: state.isPlaying,
          last_updated_by: user.id,
          updated_at: new Date().toISOString()
        }, { onConflict: 'room_id' });
    } catch (error) {
      console.error('[VideoSync] DB update failed:', error);
    }

    // Broadcast via realtime
    if (channelRef.current) {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'video_state',
        payload: newState
      });
    }

    setVideoState(newState);
    console.log('[VideoSync] Broadcast state:', state.isPlaying ? 'playing' : 'paused', state.currentTime);
  }, [user, roomId]);

  // Host: Update and broadcast state
  const updateState = useCallback((updates: Partial<VideoState>) => {
    if (!isHost || !user) return;
    
    const newState: VideoState = {
      sourceType: videoState?.sourceType || 'url',
      sourceUrl: videoState?.sourceUrl || '',
      currentTime: videoState?.currentTime || 0,
      isPlaying: videoState?.isPlaying || false,
      playbackRate: videoState?.playbackRate || 1,
      updatedAt: Date.now(),
      updatedBy: user.id,
      ...updates
    };
    
    broadcastState(newState);
  }, [isHost, user, videoState, broadcastState]);

  // Host: Start periodic sync
  const startPeriodicSync = useCallback((getCurrentTime: () => number) => {
    if (!isHost) return;
    
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
    }
    
    syncIntervalRef.current = window.setInterval(() => {
      if (videoState?.isPlaying) {
        updateState({ currentTime: getCurrentTime() });
      }
    }, SYNC_INTERVAL);
  }, [isHost, videoState?.isPlaying, updateState]);

  // Stop periodic sync
  const stopPeriodicSync = useCallback(() => {
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
  }, []);

  // Calculate if sync is needed
  const needsSync = useCallback((localTime: number, remoteTime: number): boolean => {
    return Math.abs(localTime - remoteTime) > DRIFT_THRESHOLD;
  }, []);

  // Subscribe to video state updates
  useEffect(() => {
    if (!roomId || !user) return;

    const channel = supabase
      .channel(`video_sync_${roomId}`)
      .on('broadcast', { event: 'video_state' }, ({ payload }) => {
        const state = payload as VideoState;
        
        // Ignore own broadcasts
        if (state.updatedBy === user.id) return;
        
        console.log('[VideoSync] Received state from', isHost ? 'listener' : 'host');
        setIsSyncing(true);
        setVideoState(state);
        
        setTimeout(() => setIsSyncing(false), 500);
      })
      .subscribe();

    channelRef.current = channel;

    // Fetch initial state from DB
    const fetchInitialState = async () => {
      try {
        const { data } = await supabase
          .from('playback_state')
          .select('*')
          .eq('room_id', roomId)
          .single();
        
        if (data) {
          setVideoState({
            sourceType: 'url',
            sourceUrl: '',
            currentTime: data.current_time_seconds || 0,
            isPlaying: data.is_playing || false,
            playbackRate: 1,
            updatedAt: new Date(data.updated_at).getTime(),
            updatedBy: data.last_updated_by || ''
          });
        }
      } catch (error) {
        console.log('[VideoSync] No initial state found');
      }
    };

    fetchInitialState();

    return () => {
      stopPeriodicSync();
      supabase.removeChannel(channel);
    };
  }, [roomId, user, isHost, stopPeriodicSync]);

  return {
    videoState,
    isSyncing,
    updateState,
    broadcastState,
    startPeriodicSync,
    stopPeriodicSync,
    needsSync,
    DRIFT_THRESHOLD
  };
};
