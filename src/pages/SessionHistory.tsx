import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Clock, Heart, MessageSquare, Calendar, Video } from 'lucide-react';
import { format } from 'date-fns';

interface SessionData {
  id: string;
  room_id: string;
  room_name: string;
  date: string;
  videos_watched: Array<{
    title: string;
    url: string;
    type: string;
    watched_at: string;
  }>;
  notes_count: number;
  reactions_count: number;
  duration_minutes: number;
}

export const SessionHistory = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchSessions = async () => {
      try {
        // Fetch rooms user is part of
        const { data: rooms, error: roomsError } = await supabase
          .from('rooms')
          .select('id, name, created_at')
          .or(`creator_id.eq.${user.id},partner_id.eq.${user.id}`)
          .order('created_at', { ascending: false })
          .limit(50);

        if (roomsError) throw roomsError;

        // For each room, fetch video queue history, notes, and love stats
        const sessionsData = await Promise.all(
          rooms?.map(async (room) => {
            // Get videos from queue
            const { data: videos } = await supabase
              .from('video_queue')
              .select('title, url, type, created_at')
              .eq('room_id', room.id)
              .order('created_at', { ascending: false });

            // Get notes count
            const { count: notesCount } = await supabase
              .from('timestamped_notes')
              .select('*', { count: 'exact', head: true })
              .eq('room_id', room.id);

            // Get reactions count (hearts sent/received)
            const { data: stats } = await supabase
              .from('love_stats')
              .select('hearts_sent, hearts_received, watch_time_minutes')
              .eq('user_id', user.id)
              .eq('date', format(new Date(room.created_at), 'yyyy-MM-dd'))
              .single();

            return {
              id: room.id,
              room_id: room.id,
              room_name: room.name,
              date: room.created_at,
              videos_watched: videos?.map(v => ({
                title: v.title,
                url: v.url,
                type: v.type,
                watched_at: v.created_at
              })) || [],
              notes_count: notesCount || 0,
              reactions_count: (stats?.hearts_sent || 0) + (stats?.hearts_received || 0),
              duration_minutes: stats?.watch_time_minutes || 0
            };
          }) || []
        );

        setSessions(sessionsData);
      } catch (error) {
        console.error('Error fetching session history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading your watch history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex items-center gap-3">
          <Calendar className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Session History</h1>
            <p className="text-muted-foreground">
              All your watch parties, reactions, and memories together
            </p>
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="space-y-4">
            {sessions.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Video className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-xl font-semibold mb-2">No watch sessions yet</h3>
                  <p className="text-muted-foreground">
                    Start watching videos together to build your watch history!
                  </p>
                </CardContent>
              </Card>
            ) : (
              sessions.map((session) => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  whileHover={{ scale: 1.02 }}
                >
                  <Card className="overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-primary/10 to-transparent">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-xl">{session.room_name}</CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            {format(new Date(session.date), 'EEEE, MMMM d, yyyy')}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {session.duration_minutes > 0 && (
                            <Badge variant="secondary" className="gap-1">
                              <Clock className="w-3 h-3" />
                              {session.duration_minutes}m
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                      {session.videos_watched.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="font-semibold flex items-center gap-2">
                            <Video className="w-4 h-4" />
                            Videos Watched ({session.videos_watched.length})
                          </h4>
                          <div className="space-y-2">
                            {session.videos_watched.slice(0, 3).map((video, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                              >
                                <Badge variant="outline" className="text-xs">
                                  {video.type}
                                </Badge>
                                <span className="text-sm flex-1 truncate">{video.title}</span>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(video.watched_at), 'h:mm a')}
                                </span>
                              </div>
                            ))}
                            {session.videos_watched.length > 3 && (
                              <p className="text-xs text-muted-foreground text-center">
                                + {session.videos_watched.length - 3} more videos
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      <Separator className="my-4" />

                      <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2">
                          <Heart className="w-4 h-4 text-red-500" />
                          <span className="text-muted-foreground">
                            {session.reactions_count} reactions
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-blue-500" />
                          <span className="text-muted-foreground">
                            {session.notes_count} notes
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        </ScrollArea>
      </motion.div>
    </div>
  );
};
