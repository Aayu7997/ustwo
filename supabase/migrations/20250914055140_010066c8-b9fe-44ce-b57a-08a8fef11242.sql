-- Create preferences table for AI-powered recommendations
CREATE TABLE public.preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  genres text[],
  actors text[],
  directors text[],
  platforms text[],
  disliked text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.preferences ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own preferences" 
ON public.preferences 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences" 
ON public.preferences 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences" 
ON public.preferences 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_preferences_updated_at
BEFORE UPDATE ON public.preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create AI recommendations table to store generated recommendations
CREATE TABLE public.ai_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  partner_id uuid NOT NULL REFERENCES auth.users(id),
  recommendations jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;

-- Create policies for AI recommendations
CREATE POLICY "Room members can view AI recommendations" 
ON public.ai_recommendations 
FOR SELECT 
USING (user_id = auth.uid() OR partner_id = auth.uid());

CREATE POLICY "Users can insert AI recommendations" 
ON public.ai_recommendations 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- Create saved recommendations table for couple's timeline
CREATE TABLE public.saved_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  recommendation_data jsonb NOT NULL,
  saved_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saved_recommendations ENABLE ROW LEVEL SECURITY;

-- Create policies for saved recommendations
CREATE POLICY "Room members can view saved recommendations" 
ON public.saved_recommendations 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.rooms r 
  WHERE r.id = room_id 
  AND (r.creator_id = auth.uid() OR r.partner_id = auth.uid())
));

CREATE POLICY "Room members can save recommendations" 
ON public.saved_recommendations 
FOR INSERT 
WITH CHECK (
  saved_by = auth.uid() AND 
  EXISTS (
    SELECT 1 FROM public.rooms r 
    WHERE r.id = room_id 
    AND (r.creator_id = auth.uid() OR r.partner_id = auth.uid())
  )
);