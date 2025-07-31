import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/components/ui/use-toast';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  creator_id: string;
  partner_id?: string;
  room_id?: string;
  created_at: string;
  updated_at: string;
}

export const useCalendar = (partnerId?: string) => {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEvents = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .or(`creator_id.eq.${user.id},partner_id.eq.${user.id}`)
        .order('start_time', { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error: any) {
      console.error('Error fetching events:', error);
      toast({
        title: "Error",
        description: "Failed to load calendar events",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createEvent = async (event: Omit<CalendarEvent, 'id' | 'created_at' | 'updated_at' | 'creator_id'>) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .insert({
          ...event,
          creator_id: user.id,
          partner_id: partnerId
        })
        .select()
        .single();

      if (error) throw error;

      setEvents(prev => [...prev, data]);
      toast({
        title: "Event Created",
        description: `"${event.title}" has been added to your calendar`
      });

      return data;
    } catch (error: any) {
      console.error('Error creating event:', error);
      toast({
        title: "Error",
        description: "Failed to create calendar event",
        variant: "destructive"
      });
      return null;
    }
  };

  const updateEvent = async (id: string, updates: Partial<CalendarEvent>) => {
    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setEvents(prev => prev.map(event => 
        event.id === id ? { ...event, ...data } : event
      ));

      toast({
        title: "Event Updated",
        description: "Calendar event has been updated"
      });

      return data;
    } catch (error: any) {
      console.error('Error updating event:', error);
      toast({
        title: "Error", 
        description: "Failed to update calendar event",
        variant: "destructive"
      });
      return null;
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [user]);

  // Real-time subscription for calendar events
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('calendar_events_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calendar_events'
        },
        () => {
          fetchEvents(); // Refresh events on any change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return {
    events,
    loading,
    createEvent,
    updateEvent,
    refetch: fetchEvents
  };
};