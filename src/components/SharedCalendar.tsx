import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Calendar as CalendarIcon, Plus, Clock, Trash2, Bell } from 'lucide-react';
import { format, parseISO, isBefore } from 'date-fns';

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  scheduled_time: string;
  duration_minutes: number;
  created_by: string;
}

interface SharedCalendarProps {
  roomId: string;
}

export const SharedCalendar: React.FC<SharedCalendarProps> = ({ roomId }) => {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    time: '20:00',
    duration: 120
  });

  useEffect(() => {
    fetchEvents();

    const channel = supabase
      .channel(`calendar_${roomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'shared_calendar_events',
        filter: `room_id=eq.${roomId}`
      }, () => {
        fetchEvents();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('shared_calendar_events')
        .select('*')
        .eq('room_id', roomId)
        .order('scheduled_time', { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Failed to fetch events:', error);
    }
  };

  const handleCreateEvent = async () => {
    if (!user || !selectedDate || !newEvent.title.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    try {
      const [hours, minutes] = newEvent.time.split(':').map(Number);
      const scheduledTime = new Date(selectedDate);
      scheduledTime.setHours(hours, minutes, 0, 0);

      const { error } = await supabase
        .from('shared_calendar_events')
        .insert({
          room_id: roomId,
          title: newEvent.title,
          description: newEvent.description || null,
          scheduled_time: scheduledTime.toISOString(),
          duration_minutes: newEvent.duration,
          created_by: user.id
        });

      if (error) throw error;

      toast({
        title: "📅 Event Created!",
        description: `${newEvent.title} scheduled for ${format(scheduledTime, 'PPp')}`
      });

      setNewEvent({ title: '', description: '', time: '20:00', duration: 120 });
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Failed to create event:', error);
      toast({
        title: "Error",
        description: "Failed to create event",
        variant: "destructive"
      });
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      const { error } = await supabase
        .from('shared_calendar_events')
        .delete()
        .eq('id', eventId);

      if (error) throw error;

      toast({
        title: "Event Deleted",
        description: "The event has been removed"
      });
    } catch (error) {
      console.error('Failed to delete event:', error);
    }
  };

  const getEventsForDate = (date: Date | undefined) => {
    if (!date) return [];
    
    return events.filter(event => {
      const eventDate = parseISO(event.scheduled_time);
      return format(eventDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
    });
  };

  const upcomingEvents = events.filter(event => 
    !isBefore(parseISO(event.scheduled_time), new Date())
  ).slice(0, 5);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            Watch Schedule
          </h3>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                New Event
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Schedule Watch Session</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="event-title">Title *</Label>
                  <Input
                    id="event-title"
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                    placeholder="Movie Night"
                  />
                </div>
                <div>
                  <Label htmlFor="event-desc">Description</Label>
                  <Textarea
                    id="event-desc"
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                    placeholder="Let's watch..."
                  />
                </div>
                <div>
                  <Label htmlFor="event-time">Time *</Label>
                  <Input
                    id="event-time"
                    type="time"
                    value={newEvent.time}
                    onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="event-duration">Duration (minutes)</Label>
                  <Input
                    id="event-duration"
                    type="number"
                    value={newEvent.duration}
                    onChange={(e) => setNewEvent({ ...newEvent, duration: parseInt(e.target.value) || 120 })}
                    min={15}
                    step={15}
                  />
                </div>
                <Button onClick={handleCreateEvent} className="w-full">
                  Create Event
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={setSelectedDate}
          className="rounded-md border"
        />

        {selectedDate && getEventsForDate(selectedDate).length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="font-medium text-sm text-muted-foreground">
              Events on {format(selectedDate, 'PPP')}
            </h4>
            {getEventsForDate(selectedDate).map((event) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-muted rounded-lg"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{event.title}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" />
                      {format(parseISO(event.scheduled_time), 'p')} • {event.duration_minutes}min
                    </p>
                    {event.description && (
                      <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteEvent(event.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="text-xl font-semibold flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5" />
          Upcoming Sessions
        </h3>

        {upcomingEvents.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No upcoming watch sessions</p>
            <p className="text-sm">Schedule one to watch together!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingEvents.map((event) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-4 bg-muted rounded-lg"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium">{event.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {format(parseISO(event.scheduled_time), 'PPP p')}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" />
                      Duration: {event.duration_minutes} minutes
                    </p>
                    {event.description && (
                      <p className="text-sm mt-2">{event.description}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteEvent(event.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};