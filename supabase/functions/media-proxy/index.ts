import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges'
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const mediaUrl = url.searchParams.get('url');
    const roomId = url.searchParams.get('room_id');

    if (!mediaUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing url parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate URL format
    let targetUrl: URL;
    try {
      targetUrl = new URL(mediaUrl);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid URL format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Block potentially dangerous protocols
    if (!['http:', 'https:'].includes(targetUrl.protocol)) {
      return new Response(
        JSON.stringify({ error: 'Invalid protocol' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Optional: Verify user is in room (requires auth header)
    const authHeader = req.headers.get('Authorization');
    if (authHeader && roomId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });

      const { error } = await supabase.rpc('get_room_if_member', { p_room_id: roomId });
      
      if (error) {
        console.log('[media-proxy] Room access denied:', error.message);
        return new Response(
          JSON.stringify({ error: 'Access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Forward range header for seeking support
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (compatible; MediaProxy/1.0)'
    };

    const rangeHeader = req.headers.get('Range');
    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }

    console.log('[media-proxy] Fetching:', mediaUrl, rangeHeader ? `Range: ${rangeHeader}` : '');

    // Fetch from origin
    const response = await fetch(mediaUrl, {
      method: 'GET',
      headers
    });

    if (!response.ok && response.status !== 206) {
      console.error('[media-proxy] Origin error:', response.status, response.statusText);
      return new Response(
        JSON.stringify({ error: `Origin returned ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build response headers
    const responseHeaders: Record<string, string> = { ...corsHeaders };

    // Forward important headers
    const forwardHeaders = [
      'Content-Type',
      'Content-Length', 
      'Content-Range',
      'Accept-Ranges',
      'Cache-Control'
    ];

    for (const header of forwardHeaders) {
      const value = response.headers.get(header);
      if (value) {
        responseHeaders[header] = value;
      }
    }

    // Ensure Accept-Ranges is set for seeking
    if (!responseHeaders['Accept-Ranges']) {
      responseHeaders['Accept-Ranges'] = 'bytes';
    }

    console.log('[media-proxy] Proxying, status:', response.status, 'type:', responseHeaders['Content-Type']);

    // Stream the response
    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders
    });

  } catch (error) {
    console.error('[media-proxy] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Proxy error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
