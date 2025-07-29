-- Create enum types for better data integrity
CREATE TYPE room_status AS ENUM ('active', 'paused', 'ended');
CREATE TYPE media_type AS ENUM ('video', 'audio', 'stream');
CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'declined');

-- Core users table for additional profile data
CREATE TABLE public.users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  partner_id UUID REFERENCES public.users(user_id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Rooms for couple sessions
CREATE TABLE public.rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status room_status DEFAULT 'active',
  is_private BOOLEAN DEFAULT true,
  room_code TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Media sources for streaming content
CREATE TABLE public.media_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  media_type media_type NOT NULL,
  duration_seconds INTEGER,
  thumbnail_url TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Playback state for synchronized viewing
CREATE TABLE public.playback_state (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  media_id UUID REFERENCES public.media_sources(id) ON DELETE SET NULL,
  current_time_seconds DECIMAL DEFAULT 0,
  is_playing BOOLEAN DEFAULT false,
  last_updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Love stats and emotional metrics
CREATE TABLE public.love_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  watch_time_minutes INTEGER DEFAULT 0,
  sessions_count INTEGER DEFAULT 0,
  hearts_sent INTEGER DEFAULT 0,
  hearts_received INTEGER DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, partner_id, date)
);

-- Notes and messages between couples
CREATE TABLE public.notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Calendar events for couple activities
CREATE TABLE public.calendar_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Invites for partner connections
CREATE TABLE public.invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_email TEXT NOT NULL,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status invite_status DEFAULT 'pending',
  invite_code TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playback_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.love_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users
CREATE POLICY "Users can view their own profile and partner's" 
ON public.users FOR SELECT 
USING (user_id = auth.uid() OR partner_id = auth.uid());

CREATE POLICY "Users can update their own profile" 
ON public.users FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own profile" 
ON public.users FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- RLS Policies for rooms
CREATE POLICY "Users can view their own rooms" 
ON public.rooms FOR SELECT 
USING (creator_id = auth.uid() OR partner_id = auth.uid());

CREATE POLICY "Users can create rooms" 
ON public.rooms FOR INSERT 
WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Room creators and partners can update" 
ON public.rooms FOR UPDATE 
USING (creator_id = auth.uid() OR partner_id = auth.uid());

-- RLS Policies for media sources
CREATE POLICY "Users can view all media" 
ON public.media_sources FOR SELECT 
USING (true);

CREATE POLICY "Users can create media" 
ON public.media_sources FOR INSERT 
WITH CHECK (created_by = auth.uid());

-- RLS Policies for playback state
CREATE POLICY "Room members can view playback state" 
ON public.playback_state FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.rooms 
    WHERE rooms.id = playback_state.room_id 
    AND (rooms.creator_id = auth.uid() OR rooms.partner_id = auth.uid())
  )
);

CREATE POLICY "Room members can update playback state" 
ON public.playback_state FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.rooms 
    WHERE rooms.id = playback_state.room_id 
    AND (rooms.creator_id = auth.uid() OR rooms.partner_id = auth.uid())
  )
);

-- RLS Policies for love stats
CREATE POLICY "Users can view their own love stats" 
ON public.love_stats FOR SELECT 
USING (user_id = auth.uid() OR partner_id = auth.uid());

CREATE POLICY "Users can manage their own love stats" 
ON public.love_stats FOR ALL
USING (user_id = auth.uid());

-- RLS Policies for notes
CREATE POLICY "Users can view their own notes" 
ON public.notes FOR SELECT 
USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Users can send notes" 
ON public.notes FOR INSERT 
WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can update their received notes" 
ON public.notes FOR UPDATE 
USING (receiver_id = auth.uid());

-- RLS Policies for calendar events
CREATE POLICY "Users can view their own events" 
ON public.calendar_events FOR SELECT 
USING (creator_id = auth.uid() OR partner_id = auth.uid());

CREATE POLICY "Users can create events" 
ON public.calendar_events FOR INSERT 
WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Event creators can update" 
ON public.calendar_events FOR UPDATE 
USING (creator_id = auth.uid());

-- RLS Policies for invites
CREATE POLICY "Users can view their own invites" 
ON public.invites FOR SELECT 
USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Users can send invites" 
ON public.invites FOR INSERT 
WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can update received invites" 
ON public.invites FOR UPDATE 
USING (receiver_id = auth.uid());

-- Create indexes for better performance
CREATE INDEX idx_users_partner_id ON public.users(partner_id);
CREATE INDEX idx_rooms_creator_partner ON public.rooms(creator_id, partner_id);
CREATE INDEX idx_playback_state_room_id ON public.playback_state(room_id);
CREATE INDEX idx_love_stats_date ON public.love_stats(date);
CREATE INDEX idx_notes_receiver_id ON public.notes(receiver_id);
CREATE INDEX idx_calendar_events_start_time ON public.calendar_events(start_time);
CREATE INDEX idx_invites_code ON public.invites(invite_code);
CREATE INDEX idx_invites_receiver_email ON public.invites(receiver_email);

-- Create triggers for updating timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON public.rooms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_playback_state_updated_at BEFORE UPDATE ON public.playback_state FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_love_stats_updated_at BEFORE UPDATE ON public.love_stats FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_calendar_events_updated_at BEFORE UPDATE ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_invites_updated_at BEFORE UPDATE ON public.invites FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate unique room codes
CREATE OR REPLACE FUNCTION public.generate_room_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  exists_check INTEGER;
BEGIN
  LOOP
    code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
    SELECT COUNT(*) INTO exists_check FROM public.rooms WHERE room_code = code;
    EXIT WHEN exists_check = 0;
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Function to generate unique invite codes
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  exists_check INTEGER;
BEGIN
  LOOP
    code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
    SELECT COUNT(*) INTO exists_check FROM public.invites WHERE invite_code = code;
    EXIT WHEN exists_check = 0;
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Auto-generate room codes and invite codes
ALTER TABLE public.rooms ALTER COLUMN room_code SET DEFAULT public.generate_room_code();
ALTER TABLE public.invites ALTER COLUMN invite_code SET DEFAULT public.generate_invite_code();