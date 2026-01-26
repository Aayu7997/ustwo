import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGoogleCalendarSync } from '@/hooks/useGoogleCalendarSync';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Clock, 
  Trash2, 
  Bell,
  Heart,
  Download,
  ExternalLink,
  Sparkles,
  Film,
  Popcorn,
  MoreVertical
} from 'lucide-react';
import { format, parseISO, isBefore, addMinutes, isToday, isTomorrow } from 'date-fns';
import { cn } from '@/lib/utils';

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  scheduled_time: string;
  duration_minutes: number;
  created_by: string;
  google_event_id?: string | null;
}

interface EnhancedSharedCalendarProps {
  roomId: string;
}

export const EnhancedSharedCalendar: React.FC<EnhancedSharedCalendarProps> = ({ roomId }) => {
  const { user } = useAuth();
  const { addToGoogleCalendar, downloadICSFile, syncToGoogleCalendar, isConnected, isSyncing } = useGoogleCalendarSync();
  
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

      const { data, error } = await supabase
        .from('shared_calendar_events')
        .insert({
          room_id: roomId,
          title: newEvent.title,
          description: newEvent.description || null,
          scheduled_time: scheduledTime.toISOString(),
          duration_minutes: newEvent.duration,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "📅 Watch Session Scheduled!",
        description: `${newEvent.title} on ${format(scheduledTime, 'PPp')}`
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
        description: "The watch session has been removed"
      });
    } catch (error) {
      console.error('Failed to delete event:', error);
    }
  };

  const handleAddToCalendar = (event: CalendarEvent, method: 'google' | 'ics' | 'sync') => {
    const startTime = parseISO(event.scheduled_time);
    const endTime = addMinutes(startTime, event.duration_minutes);
    
    const calendarEvent = {
      title: `🎬 ${event.title} - Watch Together`,
      description: event.description || 'Watch session with your partner on UsTwo',
      startTime,
      endTime
    };

    switch (method) {
      case 'google':
        addToGoogleCalendar(calendarEvent);
        break;
      case 'ics':
        downloadICSFile(calendarEvent);
        break;
      case 'sync':
        syncToGoogleCalendar(calendarEvent);
        break;
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

  const getEventDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEE, MMM d');
  };

  // Get dates with events for calendar highlighting
  const eventDates = events.map(e => format(parseISO(e.scheduled_time), 'yyyy-MM-dd'));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Calendar Card */}
      <Card className="p-6 glass-card">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-romantic flex items-center justify-center">
              <CalendarIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Watch Schedule</h3>
              <p className="text-sm text-muted-foreground">Plan your movie nights</p>
            </div>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2 bg-gradient-romantic hover:opacity-90">
                <Plus className="w-4 h-4" />
                Schedule
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Popcorn className="w-5 h-5 text-primary" />
                  Schedule Watch Session
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="event-title">Title *</Label>
                  <Input
                    id="event-title"
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                    placeholder="Movie Night 🎬"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="event-desc">Description</Label>
                  <Textarea
                    id="event-desc"
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                    placeholder="What are we watching?"
                    className="mt-1.5"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="event-time">Time *</Label>
                    <Input
                      id="event-time"
                      type="time"
                      value={newEvent.time}
                      onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="event-duration">Duration (min)</Label>
                    <Input
                      id="event-duration"
                      type="number"
                      value={newEvent.duration}
                      onChange={(e) => setNewEvent({ ...newEvent, duration: parseInt(e.target.value) || 120 })}
                      min={15}
                      step={15}
                      className="mt-1.5"
                    />
                  </div>
                </div>
                <Button onClick={handleCreateEvent} className="w-full gap-2 bg-gradient-romantic">
                  <Heart className="w-4 h-4" />
                  Create Watch Date
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={setSelectedDate}
          className="rounded-xl border-0"
          modifiers={{
            hasEvent: (date) => eventDates.includes(format(date, 'yyyy-MM-dd'))
          }}
          modifiersStyles={{
            hasEvent: { 
              fontWeight: 'bold',
              backgroundColor: 'hsl(var(--primary) / 0.1)',
              color: 'hsl(var(--primary))'
            }
          }}
        />

        {/* Events for Selected Date */}
        <AnimatePresence mode="wait">
          {selectedDate && getEventsForDate(selectedDate).length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-4 space-y-2"
            >
              <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                {format(selectedDate, 'EEEE, MMMM d')}
              </h4>
              {getEventsForDate(selectedDate).map((event) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-3 bg-primary/5 border border-primary/10 rounded-xl"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{event.title}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        {format(parseISO(event.scheduled_time), 'h:mm a')} • {event.duration_minutes}min
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleAddToCalendar(event, 'google')}>
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Add to Google Calendar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAddToCalendar(event, 'ics')}>
                          <Download className="w-4 h-4 mr-2" />
                          Download .ics
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDeleteEvent(event.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Upcoming Sessions Card */}
      <Card className="p-6 glass-card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <Bell className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Upcoming Sessions</h3>
            <p className="text-sm text-muted-foreground">Your next watch dates</p>
          </div>
        </div>

        {upcomingEvents.length === 0 ? (
          <div className="text-center py-12">
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Film className="w-16 h-16 mx-auto text-muted-foreground/30" />
            </motion.div>
            <p className="text-muted-foreground mt-4">No upcoming watch sessions</p>
            <p className="text-sm text-muted-foreground">Schedule one to watch together! 💕</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingEvents.map((event, index) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  "p-4 rounded-xl border transition-colors",
                  isToday(parseISO(event.scheduled_time)) 
                    ? "bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20" 
                    : "bg-muted/50 border-border hover:border-primary/30"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {isToday(parseISO(event.scheduled_time)) && (
                        <Badge variant="default" className="text-xs bg-primary">Today</Badge>
                      )}
                      {isTomorrow(parseISO(event.scheduled_time)) && (
                        <Badge variant="secondary" className="text-xs">Tomorrow</Badge>
                      )}
                    </div>
                    <h4 className="font-medium">{event.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      {getEventDateLabel(event.scheduled_time)} at {format(parseISO(event.scheduled_time), 'h:mm a')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Duration: {event.duration_minutes} minutes
                    </p>
                    {event.description && (
                      <p className="text-sm mt-2 text-muted-foreground">{event.description}</p>
                    )}
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleAddToCalendar(event, 'google')}>
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Google Calendar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleAddToCalendar(event, 'ics')}>
                        <Download className="w-4 h-4 mr-2" />
                        Download .ics
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDeleteEvent(event.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
