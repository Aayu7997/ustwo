-- Create video_queue table for playlist feature
CREATE TABLE IF NOT EXISTS public.video_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('youtube', 'vimeo', 'url')),
  position INTEGER NOT NULL DEFAULT 0,
  added_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create timestamped_notes table for synchronized comments
CREATE TABLE IF NOT EXISTS public.timestamped_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name TEXT,
  timestamp INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.video_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timestamped_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for video_queue
CREATE POLICY "Room members can view queue"
ON public.video_queue FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rooms r
    WHERE r.id = video_queue.room_id
    AND (r.creator_id = auth.uid() OR r.partner_id = auth.uid())
  )
);

CREATE POLICY "Room members can add to queue"
ON public.video_queue FOR INSERT
WITH CHECK (
  added_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.rooms r
    WHERE r.id = video_queue.room_id
    AND (r.creator_id = auth.uid() OR r.partner_id = auth.uid())
  )
);

CREATE POLICY "Room members can modify queue"
ON public.video_queue FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.rooms r
    WHERE r.id = video_queue.room_id
    AND (r.creator_id = auth.uid() OR r.partner_id = auth.uid())
  )
);

CREATE POLICY "Room members can delete from queue"
ON public.video_queue FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.rooms r
    WHERE r.id = video_queue.room_id
    AND (r.creator_id = auth.uid() OR r.partner_id = auth.uid())
  )
);

-- RLS Policies for timestamped_notes
CREATE POLICY "Room members can view notes"
ON public.timestamped_notes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rooms r
    WHERE r.id = timestamped_notes.room_id
    AND (r.creator_id = auth.uid() OR r.partner_id = auth.uid())
  )
);

CREATE POLICY "Room members can add notes"
ON public.timestamped_notes FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.rooms r
    WHERE r.id = timestamped_notes.room_id
    AND (r.creator_id = auth.uid() OR r.partner_id = auth.uid())
  )
);

-- Add realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.video_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE public.timestamped_notes;

-- Create indexes for performance
CREATE INDEX idx_video_queue_room_id ON public.video_queue(room_id);
CREATE INDEX idx_video_queue_position ON public.video_queue(position);
CREATE INDEX idx_timestamped_notes_room_id ON public.timestamped_notes(room_id);
CREATE INDEX idx_timestamped_notes_timestamp ON public.timestamped_notes(timestamp);