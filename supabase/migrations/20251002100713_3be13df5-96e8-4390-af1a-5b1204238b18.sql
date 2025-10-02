-- Add explicit documentation and ensure the policy handles NULL receiver_id safely
-- The existing policy already restricts to sender/receiver, but let's make it even more explicit

DROP POLICY IF EXISTS "Sender or receiver can view invites" ON public.invites;

CREATE POLICY "Only sender or assigned receiver can view invites"
ON public.invites
FOR SELECT
USING (
  -- Only the sender can see the invite
  (sender_id = auth.uid())
  OR 
  -- OR the receiver (only if receiver_id is set and matches)
  (receiver_id IS NOT NULL AND receiver_id = auth.uid())
);

-- Add documentation
COMMENT ON POLICY "Only sender or assigned receiver can view invites" ON public.invites IS 
'Prevents email harvesting by strictly limiting invite visibility. Only the sender who created the invite or the user who has been assigned as receiver_id can view invite records including receiver_email field. Unclaimed invites (receiver_id IS NULL) are only visible to the sender.';

-- Verify RLS is enabled
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Optional: Log access attempts for auditing (if needed for compliance)
COMMENT ON TABLE public.invites IS 
'Contains invitation data with PII (receiver_email). Access is strictly controlled via RLS policies to prevent email harvesting attacks.';