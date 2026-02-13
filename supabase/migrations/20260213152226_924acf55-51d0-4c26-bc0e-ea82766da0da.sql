
-- Allow room members to delete rtc_signaling records (needed for cleanup)
CREATE POLICY "Room members can delete rtc signaling"
  ON public.rtc_signaling FOR DELETE
  USING (
    sender = auth.uid()
    OR EXISTS (
      SELECT 1 FROM rooms r
      WHERE r.id = rtc_signaling.room_id
        AND (r.creator_id = auth.uid() OR r.partner_id = auth.uid())
    )
  );
