-- Create a secure RPC to join a room by code and return the room
CREATE OR REPLACE FUNCTION public.join_room_by_code(p_code text)
RETURNS public.rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.rooms%ROWTYPE;
  u uuid;
BEGIN
  u := auth.uid();
  IF u IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO r
  FROM public.rooms
  WHERE room_code = UPPER(p_code)
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'room_not_found';
  END IF;

  -- Add user to room_members if not already a member
  INSERT INTO public.room_members (room_id, user_id)
  SELECT r.id, u
  WHERE NOT EXISTS (
    SELECT 1 FROM public.room_members m WHERE m.room_id = r.id AND m.user_id = u
  );

  -- If partner slot empty and user is not the creator, set as partner
  IF r.partner_id IS NULL AND r.creator_id <> u THEN
    UPDATE public.rooms SET partner_id = u WHERE id = r.id;
    r.partner_id := u;
  END IF;

  RETURN r;
END;
$$;

-- Helpful index for fast lookups by code
CREATE INDEX IF NOT EXISTS idx_rooms_room_code ON public.rooms (room_code);
