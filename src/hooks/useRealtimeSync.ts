import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PlaybackState } from './useRoom';
import { useAuth } from './useAuth';

type SyncEventType = 'play' | 'pause' | 'seek' | 'buffering' | 'loaded' | 'heart';

interface SyncEvent {
  type: SyncEventType;
  currentTime: number;
  isPlaying: boolean;
  timestamp: number;
  userId: string;
}

interface RealtimeSyncProps {
  roomId: string;
  onPlaybackUpdate: (state: PlaybackState) => void;
  onMediaSync: (currentTime: number, isPlaying: boolean) => void;
  onSyncEvent?: (event: SyncEvent) => void;
}

export const useRealtimeSync = ({ roomId, onPlaybackUpdate, onMediaSync, onSyncEvent }: RealtimeSyncProps) => {
  const { user } = useAuth();
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!roomId) return;

    console.log('[RealtimeSync] Setting up channel for room:', roomId);

    // Create realtime channel for the room
    const channel = supabase.channel(`room_${roomId}`, {
      config: {
        broadcast: { self: false } // Don't receive own broadcasts
      }
    })
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'playback_state',
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          const newState = payload.new as PlaybackState;
          // Skip updates that we sent ourselves
          if (newState.last_updated_by === user?.id) return;

          console.log('[RealtimeSync] DB UPDATE from partner:', {
            time: newState.current_time_seconds,
            playing: newState.is_playing
          });
          onPlaybackUpdate(newState);
          onMediaSync(newState.current_time_seconds ?? 0, newState.is_playing ?? false);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'playback_state',
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          const newState = payload.new as PlaybackState;
          // Skip updates that we sent ourselves
          if (newState.last_updated_by === user?.id) return;

          console.log('[RealtimeSync] DB INSERT from partner:', {
            time: newState.current_time_seconds,
            playing: newState.is_playing
          });
          onPlaybackUpdate(newState);
          onMediaSync(newState.current_time_seconds ?? 0, newState.is_playing ?? false);
        }
      )
      .on('broadcast', { event: 'sync_event' }, (payload) => {
        const event = payload.payload as SyncEvent;
        
        // Don't process our own events (backup check)
        if (event.userId === user?.id) return;
        
        console.log('[RealtimeSync] Broadcast sync_event:', event.type, 'time:', event.currentTime.toFixed(1));
        onSyncEvent?.(event);
        onMediaSync(event.currentTime, event.isPlaying);
      })
      .subscribe((status) => {
        console.log('[RealtimeSync] Channel status:', status);
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [roomId, onPlaybackUpdate, onMediaSync, onSyncEvent, user?.id]);

  const sendPlaybackUpdate = async (currentTime: number, isPlaying: boolean) => {
    if (!user?.id) return;
    
    try {
      console.log('[RealtimeSync] Sending DB update:', { time: currentTime.toFixed(1), playing: isPlaying });
      
      // Use upsert for atomic operation
      const { error } = await supabase
        .from('playback_state')
        .upsert({
          room_id: roomId,
          current_time_seconds: currentTime,
          is_playing: isPlaying,
          last_updated_by: user.id,
          updated_at: new Date().toISOString()
        }, { 
          onConflict: 'room_id',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error('[RealtimeSync] DB upsert error:', error);
      }
    } catch (error) {
      console.error('[RealtimeSync] Error sending playback update:', error);
    }
  };

  const sendSyncEvent = async (type: SyncEventType, currentTime: number, isPlaying: boolean) => {
    if (!user || !channelRef.current) return;

    const event: SyncEvent = {
      type,
      currentTime,
      isPlaying,
      timestamp: Date.now(),
      userId: user.id
    };

    try {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'sync_event',
        payload: event
      });
      console.log('Sent sync event:', event);
    } catch (error) {
      console.error('Error sending sync event:', error);
    }
  };

  return {
    sendPlaybackUpdate,
    sendSyncEvent
  };
};