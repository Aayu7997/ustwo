import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface YouTubeVideoInfo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: string;
  channelTitle: string;
  viewCount: string;
  publishedAt: string;
}

export interface YouTubeSearchResult {
  id: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt: string;
}

export const useYouTubeAPI = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<YouTubeSearchResult[]>([]);
  const [videoInfo, setVideoInfo] = useState<YouTubeVideoInfo | null>(null);

  const getVideoInfo = useCallback(async (videoId: string): Promise<YouTubeVideoInfo | null> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('youtube-api', {
        body: { action: 'getVideoInfo', videoId }
      });

      if (error) {
        console.error('[YouTubeAPI] getVideoInfo error:', error);
        toast({
          title: 'YouTube API Error',
          description: error.message || 'Failed to fetch video info',
          variant: 'destructive'
        });
        return null;
      }

      if (data.error) {
        toast({
          title: 'YouTube Error',
          description: data.error,
          variant: 'destructive'
        });
        return null;
      }

      setVideoInfo(data);
      return data as YouTubeVideoInfo;
    } catch (err) {
      console.error('[YouTubeAPI] Error:', err);
      toast({
        title: 'Error',
        description: 'Failed to connect to YouTube API',
        variant: 'destructive'
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const searchVideos = useCallback(async (query: string, maxResults = 10): Promise<YouTubeSearchResult[]> => {
    if (!query.trim()) {
      setSearchResults([]);
      return [];
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('youtube-api', {
        body: { action: 'search', query, maxResults }
      });

      if (error) {
        console.error('[YouTubeAPI] search error:', error);
        toast({
          title: 'YouTube API Error',
          description: error.message || 'Search failed',
          variant: 'destructive'
        });
        return [];
      }

      if (data.error) {
        toast({
          title: 'Search Error',
          description: data.error,
          variant: 'destructive'
        });
        return [];
      }

      const results = data.results || [];
      setSearchResults(results);
      return results;
    } catch (err) {
      console.error('[YouTubeAPI] Error:', err);
      toast({
        title: 'Error',
        description: 'Failed to search YouTube',
        variant: 'destructive'
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setSearchResults([]);
    setVideoInfo(null);
  }, []);

  return {
    isLoading,
    searchResults,
    videoInfo,
    getVideoInfo,
    searchVideos,
    clearResults
  };
};
