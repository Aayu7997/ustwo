import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

interface Recommendation {
  title: string;
  platform: string;
  why_recommended: string;
  genre?: string;
  rating?: string;
  poster_url?: string;
}

export const useAIRecommendations = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const generateRecommendations = useCallback(async (
    roomId: string,
    partnerId: string,
    userPreferences: any,
    partnerPreferences: any
  ): Promise<Recommendation[]> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-recommendations', {
        body: {
          userPreferences: userPreferences || {},
          partnerPreferences: partnerPreferences || {},
          roomId,
          partnerId
        }
      });

      if (error) throw error;

      return data.recommendations;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const saveRecommendation = useCallback(async (
    roomId: string,
    recommendation: Recommendation
  ) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { error } = await supabase
      .from('saved_recommendations')
      .insert({
        room_id: roomId,
        recommendation_data: recommendation as any,
        saved_by: user.id
      });

    if (error) throw error;

    toast({
      title: "Saved! ❤️",
      description: `"${recommendation.title}" saved to your couple's timeline`
    });
  }, [user]);

  const getSavedRecommendations = useCallback(async (roomId: string) => {
    if (!user) return [];

    const { data, error } = await supabase
      .from('saved_recommendations')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching saved recommendations:', error);
      return [];
    }

    return data || [];
  }, [user]);

  const getRecentRecommendations = useCallback(async (roomId: string) => {
    if (!user) return null;

    const { data, error } = await supabase
      .from('ai_recommendations')
      .select('recommendations')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching recent recommendations:', error);
      return null;
    }

    return data?.recommendations as unknown as Recommendation[] || null;
  }, [user]);

  return {
    loading,
    generateRecommendations,
    saveRecommendation,
    getSavedRecommendations,
    getRecentRecommendations
  };
};