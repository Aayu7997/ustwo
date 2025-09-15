import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';

export interface MovieRecommendation {
  title: string;
  platform: string;
  genre?: string;
  description?: string; // mapped from why_recommended
  reason?: string; // mapped from why_recommended
  rating?: string;
}

export interface UserPreferences {
  genres: string[];
  watchHistory: string[];
  preferredPlatforms: string[];
}

interface InvokeContext {
  roomId: string;
  partnerId: string;
}

export const useRecommendations = () => {
  const [recommendations, setRecommendations] = useState<MovieRecommendation[]>([]);
  const [loading, setLoading] = useState(false);

  const getRecommendations = async (
    preferences: UserPreferences,
    mood?: string,
    context?: InvokeContext
  ) => {
    if (!context?.roomId || !context?.partnerId) {
      toast({
        title: 'Pair up first',
        description: 'Join a room with your partner before requesting AI picks.',
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-recommendations', {
        body: {
          userPreferences: {
            genres: preferences.genres,
            platforms: preferences.preferredPlatforms,
            watchHistory: preferences.watchHistory,
            mood,
          },
          partnerPreferences: {},
          roomId: context.roomId,
          partnerId: context.partnerId,
        },
      });

      if (error) throw error;

      const mapped: MovieRecommendation[] = (data?.recommendations || []).map((r: any) => ({
        title: r.title,
        platform: r.platform,
        genre: r.genre,
        description: r.why_recommended,
        reason: r.why_recommended,
        rating: r.rating,
      }));

      setRecommendations(mapped);

      toast({
        title: 'Recommendations Ready!',
        description: `Found ${mapped.length} perfect matches for you both`,
      });
    } catch (error: any) {
      console.error('Error getting recommendations:', error);
      const message = error?.message || 'Unexpected error';
      toast({
        title: 'Oops!',
        description: `Couldn't get recommendations: ${message}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const surpriseMe = async (context?: InvokeContext) => {
    await getRecommendations(
      { genres: [], watchHistory: [], preferredPlatforms: [] },
      'surprise',
      context
    );
  };

  return {
    recommendations,
    loading,
    getRecommendations,
    surpriseMe,
  };
};
