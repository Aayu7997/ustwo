-- Ensure unique room_code
CREATE UNIQUE INDEX IF NOT EXISTS rooms_room_code_unique_idx ON public.rooms (room_code);

-- Create room_members table for multi-user rooms
CREATE TABLE IF NOT EXISTS public.room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL,
  user_id UUID NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);

ALTER TABLE public.room_members
  ADD CONSTRAINT room_members_room_fk FOREIGN KEY (room_id) REFERENCES public.rooms (id) ON DELETE CASCADE;

ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view room_members for their rooms"
ON public.room_members
FOR SELECT
USING (
  (user_id = auth.uid()) OR
  EXISTS (
    SELECT 1 FROM public.rooms r
    WHERE r.id = room_id AND (r.creator_id = auth.uid() OR r.partner_id = auth.uid())
  )
);

CREATE POLICY "Users can insert themselves into room_members"
ON public.room_members
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Create rtc_signaling table for WebRTC offers/answers/candidates
CREATE TABLE IF NOT EXISTS public.rtc_signaling (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL,
  room_code TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('offer', 'answer', 'candidate')),
  payload JSONB NOT NULL,
  sender UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rtc_signaling
  ADD CONSTRAINT rtc_signaling_room_fk FOREIGN KEY (room_id) REFERENCES public.rooms (id) ON DELETE CASCADE;

ALTER TABLE public.rtc_signaling ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS rtc_signaling_room_idx ON public.rtc_signaling (room_id);
CREATE INDEX IF NOT EXISTS rtc_signaling_room_code_idx ON public.rtc_signaling (room_code);

CREATE POLICY "Room members can view rtc signaling"
ON public.rtc_signaling
FOR SELECT
USING (
  sender = auth.uid() OR
  EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = room_id AND (r.creator_id = auth.uid() OR r.partner_id = auth.uid())) OR
  EXISTS (SELECT 1 FROM public.room_members m WHERE m.room_id = room_id AND m.user_id = auth.uid())
);

CREATE POLICY "Room members can insert rtc signaling"
ON public.rtc_signaling
FOR INSERT
WITH CHECK (sender = auth.uid());

-- Create torrent_links table to share magnet URIs
CREATE TABLE IF NOT EXISTS public.torrent_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL,
  room_code TEXT NOT NULL,
  magnet TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.torrent_links
  ADD CONSTRAINT torrent_links_room_fk FOREIGN KEY (room_id) REFERENCES public.rooms (id) ON DELETE CASCADE;

ALTER TABLE public.torrent_links ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS torrent_links_room_code_idx ON public.torrent_links (room_code);
CREATE INDEX IF NOT EXISTS torrent_links_room_idx ON public.torrent_links (room_id);

CREATE POLICY "Room members can view torrent links"
ON public.torrent_links
FOR SELECT
USING (
  created_by = auth.uid() OR
  EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = room_id AND (r.creator_id = auth.uid() OR r.partner_id = auth.uid())) OR
  EXISTS (SELECT 1 FROM public.room_members m WHERE m.room_id = room_id AND m.user_id = auth.uid())
);

CREATE POLICY "Room members can insert torrent links"
ON public.torrent_links
FOR INSERT
WITH CHECK (created_by = auth.uid());