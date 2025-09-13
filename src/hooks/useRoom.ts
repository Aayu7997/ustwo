
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

    setLoading(true);
    try {
      console.log('Searching for room with code:', trimmedCode);
      
      // Query room by code
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('room_code', trimmedCode)
        .maybeSingle();

      if (roomError) {
        console.error('Room query error:', roomError);
        throw roomError;
      }

      if (!roomData) {
        throw new Error(`Room code "${trimmedCode}" not found. Please check the code and try again.`);
      }

      console.log('Found room:', roomData);

      // Check if user is already the creator
      if (roomData.creator_id === user.id) {
        setRoom(roomData);
        toast({
          title: "Welcome Back! 💕",
          description: `You're the creator of "${roomData.name}"`
        });
        return roomData;
      }

      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from('room_members')
        .select('*')
        .eq('room_id', roomData.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingMember) {
        setRoom(roomData);
        toast({
          title: "Welcome Back! 💕",
          description: `You're already in "${roomData.name}"`
        });
        return roomData;
      }

      // Add user to room_members table
      const { error: memberError } = await supabase
        .from('room_members')
        .insert({
          room_id: roomData.id,
          user_id: user.id
        });

      if (memberError) {
        console.error('Room member insert error:', memberError);
        throw memberError;
      }

      // Update partner_id if room doesn't have one yet
      if (!roomData.partner_id) {
        const { error: updateError } = await supabase
          .from('rooms')
          .update({ partner_id: user.id })
          .eq('id', roomData.id);

        if (updateError) {
          console.error('Room update error:', updateError);
        }
        
        roomData.partner_id = user.id;
      }

      setRoom(roomData);
      toast({
        title: "Joined Room! 💕",
        description: `Welcome to "${roomData.name}"! You can now start watching together.`
      });
      
      return roomData;

    } catch (error: any) {
      console.error('Join room failed:', error);
      
      // Provide helpful error messages
      let errorMessage = error.message;
      if (error.message?.includes('not found')) {
        errorMessage = `Room code "${trimmedCode}" not found. Please check the code and try again.`;
      } else if (error.message?.includes('full')) {
        errorMessage = 'This room is already full. Ask the room creator for a new room.';
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        errorMessage = 'Connection error. Please check your internet and try again.';
      }

      toast({
        title: "Unable to Join Room",
        description: errorMessage,
        variant: "destructive"
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
      let roomData: Room | null = null;
      
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);
      
      if (isUUID) {
        const { data, error } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', identifier)
          .single();
          
        if (error && error.code !== 'PGRST116') throw error;
        roomData = data;
      } else {
        // Try exact match first
        const { data, error } = await supabase
          .from('rooms')
          .select('*')
          .eq('room_code', identifier.toUpperCase())
          .single();
          
        if (error && error.code !== 'PGRST116') {
          // Try case-insensitive search
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('rooms')
            .select('*')
            .ilike('room_code', identifier)
            .limit(1)
            .single();
            
          if (fallbackError && fallbackError.code !== 'PGRST116') throw fallbackError;
          roomData = fallbackData;
        } else {
          roomData = data;
        }
      }

      if (!roomData) {
        console.log('Room not found:', identifier);
        setRoom(null);
        return null;
      }

      if (roomData.creator_id !== user.id && roomData.partner_id !== user.id) {
        console.log('User does not have access to room:', roomData.id);
        toast({
          title: "Access Denied",
          description: "You don't have permission to access this room",
          variant: "destructive"
        });
        setRoom(null);
        return null;
      }

      console.log('Room fetched successfully:', roomData);
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
