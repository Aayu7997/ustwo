-- Create database functions for love stats increments
CREATE OR REPLACE FUNCTION public.increment_hearts_sent(
  p_user_id uuid,
  p_partner_id uuid,
  p_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.love_stats (user_id, partner_id, date, hearts_sent, sessions_count, watch_time_minutes, hearts_received)
  VALUES (p_user_id, p_partner_id, p_date, 1, 0, 0, 0)
  ON CONFLICT (user_id, date)
  DO UPDATE SET hearts_sent = love_stats.hearts_sent + 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_hearts_received(
  p_user_id uuid,
  p_partner_id uuid,
  p_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.love_stats (user_id, partner_id, date, hearts_received, sessions_count, watch_time_minutes, hearts_sent)
  VALUES (p_user_id, p_partner_id, p_date, 1, 0, 0, 0)
  ON CONFLICT (user_id, date)
  DO UPDATE SET hearts_received = love_stats.hearts_received + 1;
END;
$$;

-- Enable realtime for reactions broadcast
ALTER PUBLICATION supabase_realtime ADD TABLE playback_state;