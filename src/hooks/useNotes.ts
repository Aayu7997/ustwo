
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/components/ui/use-toast';

export interface Note {
  id: string;
  content: string;
  sender_id: string;
  receiver_id: string | null;
  is_read: boolean;
  is_personal: boolean;
  created_at: string;
}

export const useNotes = (partnerId?: string) => {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [detectedPartnerId, setDetectedPartnerId] = useState<string | null>(null);

  const findPartnerFromRooms = async () => {
    if (!user) return null;

    try {
      const { data: rooms, error } = await supabase
        .from('rooms')
        .select('creator_id, partner_id')
        .or(`creator_id.eq.${user.id},partner_id.eq.${user.id}`)
        .not('partner_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (rooms && rooms.length > 0) {
        const room = rooms[0];
        const partnerId = room.creator_id === user.id ? room.partner_id : room.creator_id;
        setDetectedPartnerId(partnerId);
        return partnerId;
      }
      return null;
    } catch (error) {
      console.error('Error finding partner:', error);
      return null;
    }
  };

  const fetchNotes = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);

      // If no partner ID provided, try to find one from rooms
      if (!partnerId && !detectedPartnerId) {
        await findPartnerFromRooms();
      }
    } catch (error: any) {
      console.error('Error fetching notes:', error);
      toast({
        title: "Error",
        description: "Failed to load notes",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const sendNote = async (content: string, receiverId?: string, isPersonal: boolean = false) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to send notes",
        variant: "destructive"
      });
      return null;
    }

    if (!content.trim()) {
      toast({
        title: "Error",
        description: "Note content cannot be empty",
        variant: "destructive"
      });
      return null;
    }

    // For personal notes, receiverId can be null
    if (!isPersonal && !receiverId) {
      const effectivePartnerId = getEffectivePartnerId();
      if (!effectivePartnerId) {
        toast({
          title: "Error",
          description: "No partner found to send note to",
          variant: "destructive"
        });
        return null;
      }
      receiverId = effectivePartnerId;
    }

    try {
      console.log('Sending note from', user.id, 'to', receiverId, 'content:', content.trim(), 'personal:', isPersonal);
      
      const noteData = {
        content: content.trim(),
        sender_id: user.id,
        receiver_id: isPersonal ? null : receiverId,
        is_read: false,
        is_personal: isPersonal
      };

      const { data, error } = await supabase
        .from('notes')
        .insert(noteData)
        .select()
        .single();

      if (error) {
        console.error('Note insertion error:', error);
        throw error;
      }

      console.log('Note sent successfully:', data);
      
      setNotes(prev => [data, ...prev]);
      
      if (isPersonal) {
        toast({
          title: "Personal Note Saved! 📝",
          description: "Your private note has been saved"
        });
      } else {
        toast({
          title: "Note Sent! 💕",
          description: "Your love note has been delivered"
        });
      }

      return data;
    } catch (error: any) {
      console.error('Error sending note:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send note",
        variant: "destructive"
      });
      return null;
    }
  };

  const sendPersonalNote = async (content: string) => {
    return await sendNote(content, undefined, true);
  };

  const markAsRead = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from('notes')
        .update({ is_read: true })
        .eq('id', noteId)
        .eq('receiver_id', user?.id);

      if (error) throw error;

      setNotes(prev => prev.map(note => 
        note.id === noteId ? { ...note, is_read: true } : note
      ));
    } catch (error: any) {
      console.error('Error marking note as read:', error);
    }
  };

  const getUnreadCount = () => {
    return notes.filter(note => 
      note.receiver_id === user?.id && !note.is_read
    ).length;
  };

  const getPersonalNotes = () => {
    return notes.filter(note => note.is_personal && note.sender_id === user?.id);
  };

  const getPartnerNotes = () => {
    return notes.filter(note => !note.is_personal && (note.sender_id === user?.id || note.receiver_id === user?.id));
  };

  useEffect(() => {
    fetchNotes();
  }, [user]);

  // Real-time subscription for notes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('notes_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes'
        },
        () => {
          fetchNotes(); // Refresh notes on any change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const getEffectivePartnerId = () => {
    return partnerId || detectedPartnerId;
  };

  return {
    notes,
    loading,
    sendNote,
    sendPersonalNote,
    markAsRead,
    unreadCount: getUnreadCount(),
    personalNotes: getPersonalNotes(),
    partnerNotes: getPartnerNotes(),
    refetch: fetchNotes,
    partnerId: getEffectivePartnerId()
  };
};
