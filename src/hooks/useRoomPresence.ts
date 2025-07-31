import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface PresenceUser {
  user_id: string;
  email: string;
  online_at: string;
  status: 'watching' | 'buffering' | 'paused' | 'idle';
}

export const useRoomPresence = (roomId: string) => {
  const { user } = useAuth();
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);
  const [partnerJoined, setPartnerJoined] = useState(false);

  useEffect(() => {
    if (!roomId || !user) return;

    const channel = supabase.channel(`presence_${roomId}`)
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceUser>();
        const users = Object.values(state).flat();
        setPresenceUsers(users);
        
        // Check if partner joined (someone other than current user)
        const hasPartner = users.some(u => u.user_id !== user.id);
        setPartnerJoined(hasPartner);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', key, newPresences);
        const joinedUser = newPresences[0] as unknown as PresenceUser;
        if (joinedUser?.user_id !== user.id) {
          // Partner joined - trigger animation
          setPartnerJoined(true);
        }
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', key, leftPresences);
        const leftUser = leftPresences[0] as unknown as PresenceUser;
        if (leftUser?.user_id !== user.id) {
          setPartnerJoined(false);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track our presence
          await channel.track({
            user_id: user.id,
            email: user.email || 'Unknown',
            online_at: new Date().toISOString(),
            status: 'idle'
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, user]);

  const updateStatus = async (status: PresenceUser['status']) => {
    if (!roomId || !user) return;

    const channel = supabase.channel(`presence_${roomId}`);
    await channel.track({
      user_id: user.id,
      email: user.email || 'Unknown',
      online_at: new Date().toISOString(),
      status
    });
  };

  const getCurrentPartner = () => {
    return presenceUsers.find(u => u.user_id !== user?.id);
  };

  return {
    presenceUsers,
    partnerJoined,
    currentPartner: getCurrentPartner(),
    updateStatus
  };
};