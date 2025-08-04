import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/components/ui/use-toast';

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

      // Create initial playback state
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
        description: `Room "${name}" created with code: ${data.room_code}`
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
      console.log('Looking for room with code:', trimmedCode);
      
      // Find room by code
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('room_code', trimmedCode)
        .maybeSingle();

      if (roomError) {
        console.error('Room search error:', roomError);
        throw roomError;
      }

      if (!roomData) {
        throw new Error('Room not found with that code');
      }

      console.log('Found room:', roomData);

      // Check if user is already the creator
      if (roomData.creator_id === user.id) {
        setRoom(roomData);
        toast({
          title: "Welcome Back! 💕",
          description: `You're already the creator of "${roomData.name}"`
        });
        return roomData;
      }

      // Check if room already has a partner
      if (roomData.partner_id && roomData.partner_id !== user.id) {
        throw new Error('This room is already full');
      }

      // Update room with partner if not already set
      if (!roomData.partner_id) {
        const { data: updatedRoom, error: updateError } = await supabase
          .from('rooms')
          .update({ partner_id: user.id })
          .eq('id', roomData.id)
          .select()
          .single();

        if (updateError) {
          console.error('Room update error:', updateError);
          throw updateError;
        }

        setRoom(updatedRoom);
        toast({
          title: "Joined Room! 💕",
          description: `Welcome to "${updatedRoom.name}"`
        });
        
        return updatedRoom;
      } else {
        // User is already the partner
        setRoom(roomData);
        toast({
          title: "Welcome Back! 💕",
          description: `You're already in "${roomData.name}"`
        });
        return roomData;
      }
    } catch (error: any) {
      console.error('Join room failed:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to join room",
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

  const fetchRoom = async (id: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching room:', error);
        throw error;
      }

      if (!data) {
        console.log('Room not found or no access:', id);
        setRoom(null);
        return null;
      }

      console.log('Room fetched successfully:', data);
      setRoom(data);
      return data;
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
  };

  const fetchPlaybackState = async (roomId: string) => {
    try {
      const { data, error } = await supabase
        .from('playback_state')
        .select('*')
        .eq('room_id', roomId)
        .single();

      if (error) throw error;
      setPlaybackState(data);
      return data;
    } catch (error: any) {
      console.error('Error fetching playback state:', error);
      return null;
    }
  };

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