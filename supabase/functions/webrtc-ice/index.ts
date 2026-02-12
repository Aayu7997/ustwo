import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

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

  const username = Deno.env.get("METERED_TURN_USERNAME") || "";
  const credential = Deno.env.get("METERED_TURN_CREDENTIAL") || "";

  const iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun.relay.metered.ca:80" },
    {
      urls: "turn:standard.relay.metered.ca:80",
      username,
      credential,
    },
    {
      urls: "turn:standard.relay.metered.ca:80?transport=tcp",
      username,
      credential,
    },
    {
      urls: "turn:standard.relay.metered.ca:443",
      username,
      credential,
    },
    {
      urls: "turns:standard.relay.metered.ca:443?transport=tcp",
      username,
      credential,
    },
  ];

  return new Response(
    JSON.stringify({
      iceServers,
      iceCandidatePoolSize: 10,
      source: "edge-metered",
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
