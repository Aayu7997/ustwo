import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

const DEFAULT_ICE_SERVERS: IceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turns:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // NOTE: OpenRelay credentials are public. We still keep this behind an edge function
  // so clients have a single place to load ICE config and we can swap to dynamic
  // credentials later without shipping new frontend builds.
  const iceServers = DEFAULT_ICE_SERVERS;

  return new Response(
    JSON.stringify({
      iceServers,
      iceCandidatePoolSize: 10,
      source: "edge",
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
