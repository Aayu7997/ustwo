
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

export interface Room {
  id: string;
  name: string;
  creator_id: string;
  partner_id: string | null;
  status: 'active' | 'paused' | 'ended';
  is_private: boolean;
  room_code: string;
  created_at: string;
  updated_at: string;
}

export interface PlaybackState {
  id: string;
  room_id: string;
  media_id: string | null;
  current_time_seconds: number;
  is_playing: boolean;
  last_updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export const useRoom = (roomId?: string) => {
  const { user } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);
  const [loading, setLoading] = useState(false);

  const createRoom = async (name: string) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to create a room",
        variant: "destructive"
      });
      return null;
    }

    setLoading(true);
    try {
      console.log('Creating room with name:', name, 'for user:', user.id);
      
      const { data, error } = await supabase
        .from('rooms')
        .insert({
          name: name.trim(),
          creator_id: user.id
        })
        .select()
        .single();

      if (error) {
        console.error('Room creation error:', error);
        throw error;
      }

      console.log('Room created successfully:', data);

      const { error: playbackError } = await supabase
        .from('playback_state')
        .insert({
          room_id: data.id,
          current_time_seconds: 0,
          is_playing: false,
          last_updated_by: user.id
        });

      if (playbackError) {
        console.error('Playback state creation error:', playbackError);
      }

      setRoom(data);
      toast({
        title: "Room Created! 💕",
        description: `Room "${name}" created successfully! Share code: ${data.room_code}`
      });
      
      return data;
    } catch (error: any) {
      console.error('Create room failed:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create room",
        variant: "destructive"
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async (roomCode: string) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to join a room",
        variant: "destructive"
      });
      return null;
    }

    const trimmedCode = roomCode.trim().toUpperCase();
    if (!trimmedCode) {
      toast({
        title: "Error", 
        description: "Please enter a valid room code",
        variant: "destructive"
      });
      return null;
    }

    if (trimmedCode.length !== 6) {
      toast({
        title: "Invalid Room Code",
        description: "Room codes must be exactly 6 characters",
        variant: "destructive"
      });
      return null;
    }

    setLoading(true);
    try {
      console.log('Joining room with code (RPC):', trimmedCode);

      // Use secure RPC to join by code (handles membership + partner assignment)
      const { data, error } = await supabase.rpc('join_room_by_code', { p_code: trimmedCode });

      if (error) {
        console.error('join_room_by_code error:', error);
        throw error;
      }

      if (!data) {
        throw new Error(`Room code "${trimmedCode}" not found or not accessible.`);
      }

      const roomData = data as Room;

      console.log('Successfully joined room via RPC:', roomData);
      setRoom(roomData);

      if (roomData.creator_id === user.id) {
        toast({
          title: 'Welcome Back! 💕',
          description: `You're the creator of "${roomData.name}"`
        });
      } else {
        toast({
          title: 'Joined Room! 💕',
          description: `Welcome to "${roomData.name}"! You can now start watching together.`
        });
      }

      return roomData;
    } catch (error: any) {
      console.error('Join room failed:', error);

      let errorMessage = error?.message || 'Failed to join room';
      if (errorMessage.includes('invalid_or_expired_invite')) {
        errorMessage = 'This invite code is invalid or has expired.';
      } else if (errorMessage.includes('not_authenticated')) {
        errorMessage = 'Please sign in to join a room.';
      } else if (errorMessage.includes('not found')) {
        errorMessage = `Room code "${trimmedCode}" not found. Please double-check the code and try again.`;
      }

      toast({
        title: 'Unable to Join Room',
        description: errorMessage,
        variant: 'destructive'
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updatePlaybackState = async (updates: Partial<PlaybackState>) => {
    if (!room || !user) return;

    try {
      const { error } = await supabase
        .from('playback_state')
        .update({
          ...updates,
          last_updated_by: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('room_id', room.id);

      if (error) throw error;
    } catch (error: any) {
      console.error('Error updating playback state:', error);
    }
  };

  const fetchRoom = useCallback(async (identifier: string) => {
    if (!user) return null;
    
    setLoading(true);
    try {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);
      
      let roomId = identifier;
      
      // If it's a room code, first resolve it to a UUID via join_room_by_code
      if (!isUUID) {
        const { data, error } = await supabase.rpc('join_room_by_code', { p_code: identifier.toUpperCase() });
        if (error || !data) {
          console.log('Room not found by code:', identifier);
          setRoom(null);
          return null;
        }
        const roomData = data as Room;
        console.log('Room resolved by code:', roomData);
        setRoom(roomData);
        return roomData;
      }

      // Use SECURITY DEFINER RPC to bypass RLS issues
      const { data, error } = await supabase.rpc('get_room_if_member', { p_room_id: roomId });

      if (error) {
        console.error('get_room_if_member error:', error);
        // Fallback to direct query
        const { data: directData, error: directError } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', roomId)
          .maybeSingle();
        
        if (directError || !directData) {
          console.log('Room not found:', roomId);
          setRoom(null);
          return null;
        }
        
        console.log('Room fetched via direct query:', directData);
        setRoom(directData as Room);
        return directData as Room;
      }

      if (!data) {
        console.log('Room not found or no access:', roomId);
        setRoom(null);
        return null;
      }

      const roomData = data as Room;
      console.log('Room fetched via RPC:', roomData);
      setRoom(roomData);
      return roomData;
    } catch (error: any) {
      console.error('fetchRoom error:', error);
      setRoom(null);
      toast({
        title: "Error",
        description: error.message || "Failed to load room",
        variant: "destructive"
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchPlaybackState = useCallback(async (roomId: string) => {
    try {
      const { data, error } = await supabase
        .from('playback_state')
        .select('*')
        .eq('room_id', roomId)
        .maybeSingle();

      if (error) throw error;
      setPlaybackState(data);
      return data;
    } catch (error: any) {
      console.error('Error fetching playback state:', error);
      return null;
    }
  }, []);

  useEffect(() => {
    if (roomId) {
      fetchRoom(roomId);
      fetchPlaybackState(roomId);
    }
  }, [roomId]);

  return {
    room,
    playbackState,
    loading,
    createRoom,
    joinRoom,
    updatePlaybackState,
    fetchRoom,
    fetchPlaybackState,
    setRoom,
    setPlaybackState
  };
};
