import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoId } = await req.json();

    if (!videoId) {
      return new Response(
        JSON.stringify({ error: "Missing videoId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Vimeo oEmbed is public and needs no API key
    const oembedUrl = `https://vimeo.com/api/oembed.json?url=https://vimeo.com/${videoId}`;
    console.log("[vimeo-oembed] Fetching:", oembedUrl);

    const response = await fetch(oembedUrl);

    if (!response.ok) {
      const text = await response.text();
      console.error("[vimeo-oembed] Error from Vimeo:", response.status, text);
      return new Response(
        JSON.stringify({ error: "Video not found or private" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    // Return normalized metadata
    return new Response(
      JSON.stringify({
        id: videoId,
        title: data.title || "Untitled",
        thumbnail: data.thumbnail_url || null,
        duration: data.duration || 0,
        author: data.author_name || null,
        authorUrl: data.author_url || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[vimeo-oembed] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
