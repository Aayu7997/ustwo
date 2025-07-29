import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PlaybackState } from './useRoom';

interface RealtimeSyncProps {
  roomId: string;
  onPlaybackUpdate: (state: PlaybackState) => void;
  onMediaSync: (currentTime: number, isPlaying: boolean) => void;
}

export const useRealtimeSync = ({ roomId, onPlaybackUpdate, onMediaSync }: RealtimeSyncProps) => {
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!roomId) return;

    // Create realtime channel for the room
    const channel = supabase.channel(`room_${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'playback_state',
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          console.log('Playback state updated:', payload);
          const newState = payload.new as PlaybackState;
          onPlaybackUpdate(newState);
          onMediaSync(newState.current_time_seconds, newState.is_playing);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [roomId, onPlaybackUpdate, onMediaSync]);

  const sendPlaybackUpdate = async (currentTime: number, isPlaying: boolean) => {
    try {
      await supabase
        .from('playback_state')
        .update({
          current_time_seconds: currentTime,
          is_playing: isPlaying,
          updated_at: new Date().toISOString()
        })
        .eq('room_id', roomId);
    } catch (error) {
      console.error('Error sending playback update:', error);
    }
  };

  return {
    sendPlaybackUpdate
  };
};