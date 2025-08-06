
-- Create storage bucket for shared media files
INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
VALUES ('shared-media', 'shared-media', false, ARRAY['video/mp4', 'video/webm', 'video/avi', 'video/mov', 'video/mkv'], 524288000);

-- Create table for tracking shared files
CREATE TABLE public.shared_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL,
  uploader_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  upload_status TEXT DEFAULT 'uploading' CHECK (upload_status IN ('uploading', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for shared_files
ALTER TABLE public.shared_files ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for shared_files
CREATE POLICY "Room members can view shared files" 
  ON public.shared_files 
  FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM rooms 
    WHERE rooms.id = shared_files.room_id 
    AND (rooms.creator_id = auth.uid() OR rooms.partner_id = auth.uid())
  ));

CREATE POLICY "Room members can upload files" 
  ON public.shared_files 
  FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM rooms 
    WHERE rooms.id = shared_files.room_id 
    AND (rooms.creator_id = auth.uid() OR rooms.partner_id = auth.uid())
  ) AND uploader_id = auth.uid());

CREATE POLICY "Uploader can update file status" 
  ON public.shared_files 
  FOR UPDATE 
  USING (uploader_id = auth.uid());

-- Create storage policies for shared-media bucket
CREATE POLICY "Room members can view shared media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'shared-media' AND 
    EXISTS (
      SELECT 1 FROM shared_files 
      WHERE storage_path = name 
      AND EXISTS (
        SELECT 1 FROM rooms 
        WHERE rooms.id = shared_files.room_id 
        AND (rooms.creator_id = auth.uid() OR rooms.partner_id = auth.uid())
      )
    )
  );

CREATE POLICY "Authenticated users can upload to shared media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'shared-media' AND auth.role() = 'authenticated');

CREATE POLICY "Uploader can update their files"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'shared-media' AND 
    EXISTS (
      SELECT 1 FROM shared_files 
      WHERE storage_path = name AND uploader_id = auth.uid()
    )
  );

-- Enable realtime for shared_files table
ALTER PUBLICATION supabase_realtime ADD TABLE public.shared_files;

-- Add updated_at trigger
CREATE TRIGGER update_shared_files_updated_at
  BEFORE UPDATE ON public.shared_files
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
