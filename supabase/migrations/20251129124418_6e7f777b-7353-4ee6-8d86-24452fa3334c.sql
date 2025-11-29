-- Create shared calendar events table
CREATE TABLE IF NOT EXISTS public.shared_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_time TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 120,
  reminder_sent BOOLEAN DEFAULT false,
  google_event_id TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create watchlist table for favorites
CREATE TABLE IF NOT EXISTS public.watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('youtube', 'vimeo', 'url', 'local')),
  thumbnail_url TEXT,
  added_by UUID NOT NULL,
  notes TEXT,
  is_watched BOOLEAN DEFAULT false,
  watched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shared_calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;

-- RLS Policies for calendar events
CREATE POLICY "Users can view calendar events in their rooms"
  ON public.shared_calendar_events FOR SELECT
  USING (
    room_id IN (
      SELECT id FROM public.rooms 
      WHERE creator_id = auth.uid() OR partner_id = auth.uid()
    )
  );

CREATE POLICY "Users can create calendar events in their rooms"
  ON public.shared_calendar_events FOR INSERT
  WITH CHECK (
    room_id IN (
      SELECT id FROM public.rooms 
      WHERE creator_id = auth.uid() OR partner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update calendar events in their rooms"
  ON public.shared_calendar_events FOR UPDATE
  USING (
    room_id IN (
      SELECT id FROM public.rooms 
      WHERE creator_id = auth.uid() OR partner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete calendar events in their rooms"
  ON public.shared_calendar_events FOR DELETE
  USING (
    room_id IN (
      SELECT id FROM public.rooms 
      WHERE creator_id = auth.uid() OR partner_id = auth.uid()
    )
  );

-- RLS Policies for watchlist
CREATE POLICY "Users can view watchlist in their rooms"
  ON public.watchlist FOR SELECT
  USING (
    room_id IN (
      SELECT id FROM public.rooms 
      WHERE creator_id = auth.uid() OR partner_id = auth.uid()
    )
  );

CREATE POLICY "Users can add to watchlist in their rooms"
  ON public.watchlist FOR INSERT
  WITH CHECK (
    room_id IN (
      SELECT id FROM public.rooms 
      WHERE creator_id = auth.uid() OR partner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update watchlist in their rooms"
  ON public.watchlist FOR UPDATE
  USING (
    room_id IN (
      SELECT id FROM public.rooms 
      WHERE creator_id = auth.uid() OR partner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete from watchlist in their rooms"
  ON public.watchlist FOR DELETE
  USING (
    room_id IN (
      SELECT id FROM public.rooms 
      WHERE creator_id = auth.uid() OR partner_id = auth.uid()
    )
  );

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.shared_calendar_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.watchlist;

-- Create indexes for better performance
CREATE INDEX idx_calendar_events_room_id ON public.shared_calendar_events(room_id);
CREATE INDEX idx_calendar_events_scheduled_time ON public.shared_calendar_events(scheduled_time);
CREATE INDEX idx_watchlist_room_id ON public.watchlist(room_id);
CREATE INDEX idx_watchlist_is_watched ON public.watchlist(is_watched);