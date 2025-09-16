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
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      console.log('Requesting AI recommendations with context:', context);
      
      const { data, error } = await supabase.functions.invoke('ai-recommendations', {
        body: {
          userPreferences: {
            genres: preferences.genres || [],
            platforms: preferences.preferredPlatforms || ['Netflix', 'YouTube'],
            watchHistory: preferences.watchHistory || [],
            mood: mood || 'surprise',
          },
          partnerPreferences: {
            genres: [],
            platforms: ['Netflix', 'YouTube'],
            watchHistory: [],
          },
          roomId: context.roomId,
          partnerId: context.partnerId,
        },
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      if (!data?.recommendations) {
        console.error('No recommendations in response:', data);
        throw new Error('No recommendations received from AI service');
      }

      const mapped: MovieRecommendation[] = data.recommendations.map((r: any) => ({
        title: r.title || 'Unknown Title',
        platform: r.platform || 'Unknown Platform', 
        genre: r.genre || 'Unknown Genre',
        description: r.why_recommended || 'No description available',
        reason: r.why_recommended || 'AI recommendation',
        rating: r.rating || 'Not rated',
      }));

      setRecommendations(mapped);

      toast({
        title: 'Recommendations Ready! ✨',
        description: `Found ${mapped.length} perfect matches for you both`,
      });
    } catch (error: any) {
      console.error('Error getting recommendations:', error);
      
      let errorMessage = 'Unexpected error occurred';
      
      if (error?.message?.includes('OpenRouter')) {
        errorMessage = 'AI service is temporarily unavailable';
      } else if (error?.message?.includes('Room ID')) {
        errorMessage = 'Invalid room information';
      } else if (error?.message?.includes('authentication')) {
        errorMessage = 'Please sign in and try again';
      } else if (error?.message) {
        errorMessage = error.message;
      }

      toast({
        title: 'Oops! 😅',
        description: `Couldn't get recommendations: ${errorMessage}`,
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
