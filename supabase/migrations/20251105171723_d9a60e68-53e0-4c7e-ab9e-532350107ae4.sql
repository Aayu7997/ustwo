-- Add media source tracking to rooms table for partner sync
ALTER TABLE public.rooms 
  ADD COLUMN IF NOT EXISTS current_media_url TEXT,
  ADD COLUMN IF NOT EXISTS current_media_type TEXT CHECK (current_media_type IN ('local', 'url', 'youtube', 'vimeo', 'hls', 'torrent'));

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS idx_rooms_media_type ON public.rooms(current_media_type);

-- Enable realtime for rooms table
ALTER TABLE public.rooms REPLICA IDENTITY FULL;

-- Add to realtime publication if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
  END IF;
END $$;