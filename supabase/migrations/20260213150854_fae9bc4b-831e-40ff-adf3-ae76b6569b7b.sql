
-- Fix rooms table: Drop restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Users can view their own rooms" ON public.rooms;
DROP POLICY IF EXISTS "Users can create rooms" ON public.rooms;
DROP POLICY IF EXISTS "Room creators and partners can update" ON public.rooms;

CREATE POLICY "Users can view their own rooms"
  ON public.rooms FOR SELECT
  USING ((creator_id = auth.uid()) OR (partner_id = auth.uid()));

CREATE POLICY "Users can create rooms"
  ON public.rooms FOR INSERT
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Room creators and partners can update"
  ON public.rooms FOR UPDATE
  USING ((creator_id = auth.uid()) OR (partner_id = auth.uid()));

-- Fix room_members table
DROP POLICY IF EXISTS "Members can view room_members for their rooms" ON public.room_members;
DROP POLICY IF EXISTS "Users can insert themselves into room_members" ON public.room_members;

CREATE POLICY "Members can view room_members for their rooms"
  ON public.room_members FOR SELECT
  USING ((user_id = auth.uid()) OR (EXISTS (
    SELECT 1 FROM rooms r WHERE r.id = room_members.room_id AND (r.creator_id = auth.uid() OR r.partner_id = auth.uid())
  )));

CREATE POLICY "Users can insert themselves into room_members"
  ON public.room_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Fix playback_state table
DROP POLICY IF EXISTS "Room members can update playback state" ON public.playback_state;
DROP POLICY IF EXISTS "Room members can view playback state" ON public.playback_state;

CREATE POLICY "Room members can view playback state"
  ON public.playback_state FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM rooms WHERE rooms.id = playback_state.room_id AND (rooms.creator_id = auth.uid() OR rooms.partner_id = auth.uid())
  ));

CREATE POLICY "Room members can manage playback state"
  ON public.playback_state FOR ALL
  USING (EXISTS (
    SELECT 1 FROM rooms WHERE rooms.id = playback_state.room_id AND (rooms.creator_id = auth.uid() OR rooms.partner_id = auth.uid())
  ));
