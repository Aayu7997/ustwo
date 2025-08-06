
-- Add Google Drive integration columns to shared_files table
ALTER TABLE public.shared_files 
ADD COLUMN google_drive_id TEXT,
ADD COLUMN google_drive_url TEXT,
ADD COLUMN is_google_drive BOOLEAN DEFAULT FALSE;

-- Create table for storing Google Drive tokens per user
CREATE TABLE public.google_drive_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for google_drive_tokens
ALTER TABLE public.google_drive_tokens ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for google_drive_tokens
CREATE POLICY "Users can manage their own Google Drive tokens" 
  ON public.google_drive_tokens 
  FOR ALL 
  USING (user_id = auth.uid());

-- Add updated_at trigger for google_drive_tokens
CREATE TRIGGER update_google_drive_tokens_updated_at
  BEFORE UPDATE ON public.google_drive_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Update notes table to work without partner requirement
ALTER TABLE public.notes 
ALTER COLUMN receiver_id DROP NOT NULL,
ADD COLUMN is_personal BOOLEAN DEFAULT FALSE;

-- Update notes RLS policy to allow personal notes
DROP POLICY IF EXISTS "Users can view their own notes" ON public.notes;

CREATE POLICY "Users can view their own notes" 
  ON public.notes 
  FOR SELECT 
  USING (sender_id = auth.uid() OR receiver_id = auth.uid() OR (is_personal = TRUE AND sender_id = auth.uid()));

-- Update insert policy for notes to allow personal notes
DROP POLICY IF EXISTS "Users can send notes" ON public.notes;

CREATE POLICY "Users can send notes" 
  ON public.notes 
  FOR INSERT 
  WITH CHECK (sender_id = auth.uid());
