import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type ReactionType = '❤️' | '😂' | '😮' | '👍' | '😢' | '🔥';

interface Reaction {
  id: string;
  user_id: string;
  room_id: string;
  reaction: ReactionType;
  timestamp: number;
  video_timestamp: number;
}

export const useVideoReactions = (roomId: string) => {
  const { user } = useAuth();
  const [reactions, setReactions] = useState<Reaction[]>([]);

  const sendReaction = useCallback(async (
    reaction: ReactionType,
    videoTimestamp: number
  ) => {
    if (!user) return;

    const newReaction: Reaction = {
      id: crypto.randomUUID(),
      user_id: user.id,
      room_id: roomId,
      reaction,
      timestamp: Date.now(),
      video_timestamp: videoTimestamp
    };

    // Add to local state
    setReactions(prev => [...prev, newReaction]);

    // Broadcast via Supabase realtime
    const channel = supabase.channel(`reactions:${roomId}`);
    await channel.send({
      type: 'broadcast',
      event: 'reaction',
      payload: newReaction
    });

    // Auto-remove after animation
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== newReaction.id));
    }, 3000);
  }, [user, roomId]);

  // Subscribe to partner reactions
  const subscribeToReactions = useCallback(() => {
    if (!user) return;

    const channel = supabase
      .channel(`reactions:${roomId}`)
      .on('broadcast', { event: 'reaction' }, ({ payload }) => {
        if (payload.user_id !== user.id) {
          setReactions(prev => [...prev, payload]);
          setTimeout(() => {
            setReactions(prev => prev.filter(r => r.id !== payload.id));
          }, 3000);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, roomId]);

  return {
    reactions,
    sendReaction,
    subscribeToReactions
  };
};