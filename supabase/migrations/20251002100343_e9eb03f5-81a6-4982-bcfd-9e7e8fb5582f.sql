-- Fix email harvesting vulnerability in invites table
-- Drop existing SELECT policy and create a more restrictive one

DROP POLICY IF EXISTS "Users can view their own invites" ON public.invites;

-- Create stricter SELECT policy that includes expiry validation
CREATE POLICY "Users can view their own active invites" 
ON public.invites 
FOR SELECT 
USING (
  -- User must be either sender or receiver (when receiver_id is set)
  (
    (sender_id = auth.uid()) OR 
    (receiver_id = auth.uid() AND receiver_id IS NOT NULL)
  )
  -- AND invite must not be expired
  AND expires_at > now()
  -- AND status must be valid for viewing
  AND status IN ('pending', 'accepted')
);

-- Create a security definer function to validate and retrieve invite by code
-- This prevents direct table access and enumeration attacks
CREATE OR REPLACE FUNCTION public.get_invite_by_code(p_invite_code text)
RETURNS TABLE (
  id uuid,
  sender_id uuid,
  receiver_id uuid,
  status invite_status,
  expires_at timestamp with time zone,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  -- User must be authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Return invite only if it's valid and not expired
  -- Do NOT return receiver_email to prevent harvesting
  RETURN QUERY
  SELECT 
    i.id,
    i.sender_id,
    i.receiver_id,
    i.status,
    i.expires_at,
    i.created_at
  FROM public.invites i
  WHERE i.invite_code = UPPER(p_invite_code)
    AND i.expires_at > now()
    AND i.status = 'pending'
  LIMIT 1;
  
  -- If no results, don't reveal whether invite exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_or_expired_invite';
  END IF;
END;
$$;

-- Add comment explaining the security measure
COMMENT ON FUNCTION public.get_invite_by_code IS 'Securely retrieves invite by code without exposing email addresses. Does not return receiver_email to prevent harvesting attacks.';