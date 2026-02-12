import type { RTCConfiguration } from "@/types/webrtc";
import { supabase } from "@/integrations/supabase/client";

export type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

const FALLBACK_ICE_SERVERS: IceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun.relay.metered.ca:80" },
];

const FALLBACK_CONFIG: RTCConfiguration = {
  iceServers: FALLBACK_ICE_SERVERS,
  iceCandidatePoolSize: 10,
};

let cachedConfig: RTCConfiguration | null = null;
let cachedAt = 0;
let inFlight: Promise<RTCConfiguration> | null = null;
let configReady = false;

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

const isValidConfig = (value: unknown): value is RTCConfiguration => {
  if (!value || typeof value !== "object") return false;
  const v = value as any;
  return Array.isArray(v.iceServers) && v.iceServers.length > 0;
};

/**
 * Loads ICE config from edge function and caches it.
 * Falls back to STUN-only config if edge call fails.
 */
export const getIceConfig = async (): Promise<RTCConfiguration> => {
  const now = Date.now();
  if (cachedConfig && configReady && now - cachedAt < CACHE_TTL_MS) return cachedConfig;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke("webrtc-ice", {
        method: "GET",
      });

      if (error) throw error;
      if (isValidConfig(data)) {
        cachedConfig = {
          iceServers: data.iceServers,
          iceCandidatePoolSize: (data as any).iceCandidatePoolSize ?? 10,
        };
        cachedAt = Date.now();
        configReady = true;
        console.log('[ICE] Loaded TURN config with', data.iceServers.length, 'servers');
        return cachedConfig;
      }

      throw new Error('Invalid ICE config');
    } catch (e) {
      console.warn('[ICE] Edge function failed, using fallback:', e);
      cachedConfig = FALLBACK_CONFIG;
      cachedAt = Date.now();
      configReady = true;
      return cachedConfig;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
};

/** Synchronous access – returns cached or fallback. */
export const getIceConfigSync = (): RTCConfiguration => cachedConfig ?? FALLBACK_CONFIG;

/** Whether the async config has been fetched at least once. */
export const isIceConfigReady = (): boolean => configReady;

// Prefetch on import
void getIceConfig();
