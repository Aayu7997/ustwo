import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/components/ui/use-toast';

export interface Note {
  id: string;
  content: string;
  sender_id: string;
  receiver_id: string;
  is_read: boolean;
  created_at: string;
}

export const useNotes = (partnerId?: string) => {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);

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

  const sendNote = async (content: string, receiverId: string) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('notes')
        .insert({
          content,
          sender_id: user.id,
          receiver_id: receiverId,
          is_read: false
        })
        .select()
        .single();

      if (error) throw error;

      setNotes(prev => [data, ...prev]);
      toast({
        title: "Note Sent",
        description: "Your love note has been delivered 💕"
      });

      return data;
    } catch (error: any) {
      console.error('Error sending note:', error);
      toast({
        title: "Error",
        description: "Failed to send note",
        variant: "destructive"
      });
      return null;
    }
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

  return {
    notes,
    loading,
    sendNote,
    markAsRead,
    unreadCount: getUnreadCount(),
    refetch: fetchNotes
  };
};