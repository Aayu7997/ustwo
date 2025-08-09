import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const fileId = url.searchParams.get("fileId");
    // Pass Google access token via query param `token` OR header `x-google-access-token`
    const token = url.searchParams.get("token") || req.headers.get("x-google-access-token");

    if (!fileId || !token) {
      return new Response(JSON.stringify({ error: "Missing fileId or token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Forward Range header for seeking support
    const range = req.headers.get("Range");

    const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const headers: HeadersInit = {
      Authorization: `Bearer ${token}`,
    };
    if (range) headers["Range"] = range;

    const driveRes = await fetch(driveUrl, { headers, redirect: "follow" });

    if (!driveRes.ok && driveRes.status !== 206) {
      const text = await driveRes.text();
      console.error("Drive proxy error", driveRes.status, text);
      return new Response(JSON.stringify({ error: text || "Drive fetch failed" }), {
        status: driveRes.status || 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prepare streaming response with proper headers
    const contentType = driveRes.headers.get("content-type") || "application/octet-stream";
    const contentLength = driveRes.headers.get("content-length") || undefined;
    const contentRange = driveRes.headers.get("content-range") || undefined;

    const respHeaders: HeadersInit = {
      ...corsHeaders,
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
    };
    if (contentLength) respHeaders["Content-Length"] = contentLength;
    if (contentRange) respHeaders["Content-Range"] = contentRange;

    return new Response(driveRes.body, {
      status: driveRes.status,
      headers: respHeaders,
    });
  } catch (error) {
    console.error("drive-proxy internal error", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});