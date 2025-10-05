import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface LoveMetrics {
  watchTimeMinutes: number;
  sessionsCount: number;
  heartsSent: number;
  heartsReceived: number;
  daysStreak: number;
  coupleScore: number;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: Date;
}

export const useLoveMetrics = (roomId: string, partnerId?: string) => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<LoveMetrics>({
    watchTimeMinutes: 0,
    sessionsCount: 0,
    heartsSent: 0,
    heartsReceived: 0,
    daysStreak: 0,
    coupleScore: 0
  });
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('love_stats')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(30);

      if (error) throw error;

      if (data && data.length > 0) {
        const totalWatchTime = data.reduce((sum, stat) => sum + (stat.watch_time_minutes || 0), 0);
        const totalSessions = data.reduce((sum, stat) => sum + (stat.sessions_count || 0), 0);
        const totalHeartsSent = data.reduce((sum, stat) => sum + (stat.hearts_sent || 0), 0);
        const totalHeartsReceived = data.reduce((sum, stat) => sum + (stat.hearts_received || 0), 0);

        // Calculate streak
        let streak = 0;
        const today = new Date().toISOString().split('T')[0];
        for (let i = 0; i < data.length; i++) {
          const statDate = new Date(data[i].date).toISOString().split('T')[0];
          const expectedDate = new Date();
          expectedDate.setDate(expectedDate.getDate() - i);
          const expected = expectedDate.toISOString().split('T')[0];
          
          if (statDate === expected) {
            streak++;
          } else {
            break;
          }
        }

        // Calculate couple score (0-100)
        const score = Math.min(100, Math.floor(
          (totalWatchTime / 10) + 
          (totalSessions * 5) + 
          (streak * 10) + 
          (totalHeartsSent / 2) +
          (totalHeartsReceived / 2)
        ));

        setMetrics({
          watchTimeMinutes: totalWatchTime,
          sessionsCount: totalSessions,
          heartsSent: totalHeartsSent,
          heartsReceived: totalHeartsReceived,
          daysStreak: streak,
          coupleScore: score
        });

        // Check achievements
        checkAchievements(totalWatchTime, totalSessions, streak, score);
      }
    } catch (error) {
      console.error('Error fetching love metrics:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const checkAchievements = (watchTime: number, sessions: number, streak: number, score: number) => {
    const allAchievements: Achievement[] = [
      {
        id: 'first-watch',
        title: 'First Watch',
        description: 'Watched your first video together',
        icon: '🎬',
        unlocked: sessions >= 1
      },
      {
        id: 'binge-watchers',
        title: 'Binge Watchers',
        description: 'Watched 10+ hours together',
        icon: '📺',
        unlocked: watchTime >= 600
      },
      {
        id: 'week-streak',
        title: 'Week Streak',
        description: 'Watched together for 7 days straight',
        icon: '🔥',
        unlocked: streak >= 7
      },
      {
        id: 'love-level-50',
        title: 'Love Level 50',
        description: 'Reached couple score of 50',
        icon: '💖',
        unlocked: score >= 50
      },
      {
        id: 'perfect-match',
        title: 'Perfect Match',
        description: 'Reached couple score of 100',
        icon: '💯',
        unlocked: score >= 100
      },
      {
        id: 'movie-marathon',
        title: 'Movie Marathon',
        description: 'Completed 50 watch sessions',
        icon: '🍿',
        unlocked: sessions >= 50
      }
    ];

    setAchievements(allAchievements);
  };

  const updateWatchTime = useCallback(async (minutes: number) => {
    if (!user || !partnerId) return;

    const today = new Date().toISOString().split('T')[0];

    try {
      const { error } = await supabase
        .from('love_stats')
        .upsert({
          user_id: user.id,
          partner_id: partnerId,
          date: today,
          watch_time_minutes: minutes,
          sessions_count: 1
        }, {
          onConflict: 'user_id,date',
          ignoreDuplicates: false
        });

      if (error) throw error;
      fetchMetrics();
    } catch (error) {
      console.error('Error updating watch time:', error);
    }
  }, [user, partnerId, fetchMetrics]);

  const sendHeart = useCallback(async () => {
    if (!user || !partnerId) return;

    const today = new Date().toISOString().split('T')[0];

    try {
      // Update sender's hearts sent
      await supabase.rpc('increment_hearts_sent', {
        p_user_id: user.id,
        p_partner_id: partnerId,
        p_date: today
      });

      // Update receiver's hearts received
      await supabase.rpc('increment_hearts_received', {
        p_user_id: partnerId,
        p_partner_id: user.id,
        p_date: today
      });

      fetchMetrics();
    } catch (error) {
      console.error('Error sending heart:', error);
    }
  }, [user, partnerId, fetchMetrics]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return {
    metrics,
    achievements,
    loading,
    updateWatchTime,
    sendHeart,
    refreshMetrics: fetchMetrics
  };
};