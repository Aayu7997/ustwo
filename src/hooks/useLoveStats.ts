import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/components/ui/use-toast';

export interface LoveStats {
  id: string;
  user_id: string;
  partner_id: string;
  date: string;
  watch_time_minutes: number;
  sessions_count: number;
  hearts_sent: number;
  hearts_received: number;
  created_at: string;
  updated_at: string;
}

export const useLoveStats = (partnerId?: string) => {
  const { user } = useAuth();
  const [stats, setStats] = useState<LoveStats[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchStats = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('love_stats')
        .select('*')
        .or(`user_id.eq.${user.id},partner_id.eq.${user.id}`)
        .order('date', { ascending: false });

      if (error) throw error;
      setStats(data || []);
    } catch (error: any) {
      console.error('Error fetching love stats:', error);
      toast({
        title: "Error",
        description: "Failed to load love statistics",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateTodaysStats = async (updates: {
    watchTimeMinutes?: number;
    sessionsCount?: number;
    heartsSent?: number;
    heartsReceived?: number;
  }) => {
    if (!user || !partnerId) return;

    const today = new Date().toISOString().split('T')[0];

    try {
      // Check if stats exist for today
      const { data: existingStats } = await supabase
        .from('love_stats')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .single();

      if (existingStats) {
        // Update existing stats
        const { data, error } = await supabase
          .from('love_stats')
          .update({
            watch_time_minutes: (existingStats.watch_time_minutes || 0) + (updates.watchTimeMinutes || 0),
            sessions_count: (existingStats.sessions_count || 0) + (updates.sessionsCount || 0),
            hearts_sent: (existingStats.hearts_sent || 0) + (updates.heartsSent || 0),
            hearts_received: (existingStats.hearts_received || 0) + (updates.heartsReceived || 0),
            updated_at: new Date().toISOString()
          })
          .eq('id', existingStats.id)
          .select()
          .single();

        if (error) throw error;
        
        setStats(prev => prev.map(stat => 
          stat.id === existingStats.id ? data : stat
        ));
      } else {
        // Create new stats for today
        const { data, error } = await supabase
          .from('love_stats')
          .insert({
            user_id: user.id,
            partner_id: partnerId,
            date: today,
            watch_time_minutes: updates.watchTimeMinutes || 0,
            sessions_count: updates.sessionsCount || 0,
            hearts_sent: updates.heartsSent || 0,
            hearts_received: updates.heartsReceived || 0
          })
          .select()
          .single();

        if (error) throw error;
        
        setStats(prev => [data, ...prev]);
      }
    } catch (error: any) {
      console.error('Error updating love stats:', error);
    }
  };

  const getTotalStats = () => {
    const userStats = stats.filter(stat => stat.user_id === user?.id);
    const partnerStats = stats.filter(stat => stat.partner_id === user?.id);
    
    return {
      totalWatchTime: userStats.reduce((sum, stat) => sum + (stat.watch_time_minutes || 0), 0) +
                     partnerStats.reduce((sum, stat) => sum + (stat.watch_time_minutes || 0), 0),
      totalSessions: userStats.reduce((sum, stat) => sum + (stat.sessions_count || 0), 0) +
                    partnerStats.reduce((sum, stat) => sum + (stat.sessions_count || 0), 0),
      totalHeartsSent: userStats.reduce((sum, stat) => sum + (stat.hearts_sent || 0), 0),
      totalHeartsReceived: userStats.reduce((sum, stat) => sum + (stat.hearts_received || 0), 0)
    };
  };

  const getWeeklyStats = () => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const weeklyStats = stats.filter(stat => 
      new Date(stat.date) >= oneWeekAgo && stat.user_id === user?.id
    );

    return weeklyStats.reduce((acc, stat) => ({
      watchTime: acc.watchTime + (stat.watch_time_minutes || 0),
      sessions: acc.sessions + (stat.sessions_count || 0),
      hearts: acc.hearts + (stat.hearts_sent || 0)
    }), { watchTime: 0, sessions: 0, hearts: 0 });
  };

  useEffect(() => {
    fetchStats();
  }, [user, partnerId]);

  return {
    stats,
    loading,
    updateTodaysStats,
    getTotalStats,
    getWeeklyStats,
    refetch: fetchStats
  };
};