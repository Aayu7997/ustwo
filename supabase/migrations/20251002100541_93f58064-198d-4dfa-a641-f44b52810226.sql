-- Tighten invites SELECT policy to only sender or receiver
DROP POLICY IF EXISTS "Users can view their own active invites" ON public.invites;

CREATE POLICY "Sender or receiver can view invites"
ON public.invites
FOR SELECT
USING (
  (sender_id = auth.uid()) OR (receiver_id = auth.uid())
);

-- Optional: comment explaining rationale
COMMENT ON POLICY "Sender or receiver can view invites" ON public.invites IS 'Prevents any other authenticated users from selecting invites, protecting receiver_email and invite_code from harvesting.';