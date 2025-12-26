import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface YouTubeVideoInfo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: string;
  channelTitle: string;
  viewCount: string;
  publishedAt: string;
}

interface YouTubeSearchResult {
  id: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt: string;
}

// Parse ISO 8601 duration to readable format
function parseDuration(duration: string): string {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '0:00';
  
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY');
    if (!YOUTUBE_API_KEY) {
      console.error('[YouTube API] Missing API key');
      return new Response(
        JSON.stringify({ error: 'YouTube API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, videoId, query, maxResults = 10 } = await req.json();
    console.log('[YouTube API] Action:', action, 'Query/ID:', query || videoId);

    if (action === 'getVideoInfo' && videoId) {
      // Get video details
      const url = new URL('https://www.googleapis.com/youtube/v3/videos');
      url.searchParams.set('key', YOUTUBE_API_KEY);
      url.searchParams.set('id', videoId);
      url.searchParams.set('part', 'snippet,contentDetails,statistics');

      const response = await fetch(url.toString());
      const data = await response.json();

      if (!response.ok) {
        console.error('[YouTube API] Error:', data);
        return new Response(
          JSON.stringify({ error: data.error?.message || 'Failed to fetch video info' }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!data.items || data.items.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Video not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const video = data.items[0];
      const videoInfo: YouTubeVideoInfo = {
        id: video.id,
        title: video.snippet.title,
        description: video.snippet.description,
        thumbnail: video.snippet.thumbnails.high?.url || video.snippet.thumbnails.default?.url,
        duration: parseDuration(video.contentDetails.duration),
        channelTitle: video.snippet.channelTitle,
        viewCount: video.statistics.viewCount,
        publishedAt: video.snippet.publishedAt,
      };

      console.log('[YouTube API] Video info fetched:', videoInfo.title);
      return new Response(
        JSON.stringify(videoInfo),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'search' && query) {
      // Search videos
      const url = new URL('https://www.googleapis.com/youtube/v3/search');
      url.searchParams.set('key', YOUTUBE_API_KEY);
      url.searchParams.set('q', query);
      url.searchParams.set('part', 'snippet');
      url.searchParams.set('type', 'video');
      url.searchParams.set('maxResults', String(maxResults));
      url.searchParams.set('videoEmbeddable', 'true'); // Only embeddable videos

      const response = await fetch(url.toString());
      const data = await response.json();

      if (!response.ok) {
        console.error('[YouTube API] Search error:', data);
        return new Response(
          JSON.stringify({ error: data.error?.message || 'Search failed' }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const results: YouTubeSearchResult[] = data.items.map((item: any) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
        channelTitle: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt,
      }));

      console.log('[YouTube API] Search results:', results.length);
      return new Response(
        JSON.stringify({ results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use "getVideoInfo" or "search"' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[YouTube API] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
