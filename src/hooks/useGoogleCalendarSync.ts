import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface CalendarEvent {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
}

export const useGoogleCalendarSync = () => {
  const { user, session } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Check if user has Google Calendar access via OAuth
  const checkConnection = useCallback(async () => {
    if (!user || !session) return false;
    
    // Check if provider token exists (from Google OAuth login)
    const providerToken = session.provider_token;
    if (providerToken) {
      setIsConnected(true);
      return true;
    }
    
    setIsConnected(false);
    return false;
  }, [user, session]);

  // Generate Google Calendar URL for adding event
  const generateGoogleCalendarUrl = useCallback((event: CalendarEvent) => {
    const baseUrl = 'https://calendar.google.com/calendar/render';
    
    const startDate = format(event.startTime, "yyyyMMdd'T'HHmmss");
    const endDate = format(event.endTime, "yyyyMMdd'T'HHmmss");
    
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: event.title,
      dates: `${startDate}/${endDate}`,
      details: event.description || `Watch session with your partner on UsTwo`,
      sf: 'true',
      output: 'xml'
    });
    
    if (event.location) {
      params.set('location', event.location);
    }
    
    return `${baseUrl}?${params.toString()}`;
  }, []);

  // Open Google Calendar to add event
  const addToGoogleCalendar = useCallback((event: CalendarEvent) => {
    const url = generateGoogleCalendarUrl(event);
    window.open(url, '_blank', 'width=700,height=600');
    
    toast({
      title: "Opening Google Calendar",
      description: "Add the event to your calendar in the new window"
    });
  }, [generateGoogleCalendarUrl]);

  // Create ICS file for download (universal calendar support)
  const downloadICSFile = useCallback((event: CalendarEvent) => {
    const startDate = format(event.startTime, "yyyyMMdd'T'HHmmss'Z'");
    const endDate = format(event.endTime, "yyyyMMdd'T'HHmmss'Z'");
    const now = format(new Date(), "yyyyMMdd'T'HHmmss'Z'");
    
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//UsTwo//Watch Together//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
DTSTART:${startDate}
DTEND:${endDate}
DTSTAMP:${now}
SUMMARY:${event.title}
DESCRIPTION:${event.description || 'Watch session with your partner on UsTwo'}
STATUS:CONFIRMED
SEQUENCE:0
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${event.title.replace(/\s+/g, '_')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Calendar file downloaded",
      description: "Open the .ics file to add to your calendar"
    });
  }, []);

  // Sync event to Google Calendar via API (requires OAuth connection)
  const syncToGoogleCalendar = useCallback(async (event: CalendarEvent) => {
    if (!session?.provider_token) {
      toast({
        title: "Not connected",
        description: "Sign in with Google to sync directly to your calendar",
        variant: "destructive"
      });
      return false;
    }

    setIsSyncing(true);
    
    try {
      const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.provider_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          summary: event.title,
          description: event.description || 'Watch session with your partner on UsTwo',
          start: {
            dateTime: event.startTime.toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
          },
          end: {
            dateTime: event.endTime.toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
          },
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'popup', minutes: 30 },
              { method: 'popup', minutes: 10 }
            ]
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create calendar event');
      }

      const data = await response.json();
      
      toast({
        title: "📅 Added to Google Calendar!",
        description: `${event.title} has been synced with reminders`
      });
      
      return data.id;
    } catch (error) {
      console.error('Google Calendar sync error:', error);
      toast({
        title: "Sync failed",
        description: "Could not add to Google Calendar. Try the manual option.",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, [session]);

  return {
    isConnected,
    isSyncing,
    checkConnection,
    addToGoogleCalendar,
    downloadICSFile,
    syncToGoogleCalendar,
    generateGoogleCalendarUrl
  };
};
