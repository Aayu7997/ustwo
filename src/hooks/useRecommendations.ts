import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';

export interface MovieRecommendation {
  title: string;
  platform: string;
  genre: string;
  description: string;
  reason: string;
  rating: string;
}

export interface UserPreferences {
  genres: string[];
  watchHistory: string[];
  preferredPlatforms: string[];
}

export const useRecommendations = () => {
  const [recommendations, setRecommendations] = useState<MovieRecommendation[]>([]);
  const [loading, setLoading] = useState(false);

  const getRecommendations = async (
    preferences: UserPreferences,
    mood?: string
  ) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-recommendations', {
        body: {
          genres: preferences.genres,
          watchHistory: preferences.watchHistory,
          preferredPlatforms: preferences.preferredPlatforms,
          mood
        }
      });

      if (error) throw error;

      setRecommendations(data.recommendations || []);
      
      toast({
        title: "Recommendations Ready!",
        description: `Found ${data.recommendations?.length || 0} perfect matches for you both`,
      });
    } catch (error: any) {
      console.error('Error getting recommendations:', error);
      toast({
        title: "Oops!",
        description: "Couldn't get recommendations right now. Try again?",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const surpriseMe = async () => {
    await getRecommendations(
      { genres: [], watchHistory: [], preferredPlatforms: [] },
      'surprise'
    );
  };

  return {
    recommendations,
    loading,
    getRecommendations,
    surpriseMe
  };
};