-- Create calls table for WebRTC signaling
CREATE TABLE public.calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  caller_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'calling' CHECK (status IN ('calling', 'ringing', 'accepted', 'rejected', 'ended', 'missed')),
  call_type TEXT NOT NULL DEFAULT 'video' CHECK (call_type IN ('video', 'audio')),
  offer JSONB,
  answer JSONB,
  ice_candidates JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

-- RLS Policies for calls
CREATE POLICY "Users can view calls they are part of"
ON public.calls FOR SELECT
USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can create calls"
ON public.calls FOR INSERT
WITH CHECK (auth.uid() = caller_id);

CREATE POLICY "Participants can update calls"
ON public.calls FOR UPDATE
USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

CREATE POLICY "Participants can delete calls"
ON public.calls FOR DELETE
USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

-- Create games table for couple games
CREATE TABLE public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  game_type TEXT NOT NULL CHECK (game_type IN ('would_you_rather', 'truth_or_dare', 'love_quiz', 'compatibility', 'memory')),
  current_question JSONB,
  player1_id UUID NOT NULL,
  player2_id UUID,
  player1_answer JSONB,
  player2_answer JSONB,
  score_player1 INTEGER DEFAULT 0,
  score_player2 INTEGER DEFAULT 0,
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'answered', 'completed')),
  round INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for games
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

-- RLS Policies for games
CREATE POLICY "Room members can view games"
ON public.games FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rooms r 
    WHERE r.id = room_id 
    AND (r.creator_id = auth.uid() OR r.partner_id = auth.uid())
  )
);

CREATE POLICY "Room members can create games"
ON public.games FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.rooms r 
    WHERE r.id = room_id 
    AND (r.creator_id = auth.uid() OR r.partner_id = auth.uid())
  )
);

CREATE POLICY "Room members can update games"
ON public.games FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.rooms r 
    WHERE r.id = room_id 
    AND (r.creator_id = auth.uid() OR r.partner_id = auth.uid())
  )
);

-- Create game_history for tracking
CREATE TABLE public.game_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  game_type TEXT NOT NULL,
  winner_id UUID,
  player1_score INTEGER,
  player2_score INTEGER,
  played_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for game_history
ALTER TABLE public.game_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Room members can view game history"
ON public.game_history FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rooms r 
    WHERE r.id = room_id 
    AND (r.creator_id = auth.uid() OR r.partner_id = auth.uid())
  )
);

CREATE POLICY "Room members can insert game history"
ON public.game_history FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.rooms r 
    WHERE r.id = room_id 
    AND (r.creator_id = auth.uid() OR r.partner_id = auth.uid())
  )
);

-- Add indexes for performance
CREATE INDEX idx_calls_room_id ON public.calls(room_id);
CREATE INDEX idx_calls_status ON public.calls(status);
CREATE INDEX idx_calls_receiver ON public.calls(receiver_id, status);
CREATE INDEX idx_games_room_id ON public.games(room_id);
CREATE INDEX idx_game_history_room_id ON public.game_history(room_id);

-- Update trigger for calls
CREATE TRIGGER update_calls_updated_at
BEFORE UPDATE ON public.calls
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update trigger for games
CREATE TRIGGER update_games_updated_at
BEFORE UPDATE ON public.games
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for calls and games
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.games;