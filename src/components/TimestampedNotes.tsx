import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { ScrollArea } from './ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { MessageSquare, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TimestampNote {
  id: string;
  user_id: string;
  room_id: string;
  timestamp: number;
  content: string;
  created_at: string;
  user_name?: string;
}

interface TimestampedNotesProps {
  roomId: string;
  currentTime: number;
  onSeekToTime: (time: number) => void;
}

export const TimestampedNotes: React.FC<TimestampedNotesProps> = ({ 
  roomId, 
  currentTime,
  onSeekToTime 
}) => {
  const { user } = useAuth();
  const [notes, setNotes] = useState<TimestampNote[]>([]);
  const [newNote, setNewNote] = useState('');

  useEffect(() => {
    fetchNotes();
    
    const channel = supabase
      .channel(`notes:${roomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'timestamped_notes',
        filter: `room_id=eq.${roomId}`
      }, () => {
        fetchNotes();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const fetchNotes = async () => {
    const { data, error } = await supabase
      .from('timestamped_notes')
      .select('*')
      .eq('room_id', roomId)
      .order('timestamp', { ascending: true });

    if (!error && data) {
      setNotes(data);
    }
  };

  const addNote = async () => {
    if (!newNote.trim() || !user) return;

    const { error } = await supabase
      .from('timestamped_notes')
      .insert({
        room_id: roomId,
        user_id: user.id,
        timestamp: Math.floor(currentTime),
        content: newNote,
        user_name: user.email?.split('@')[0] || 'Anonymous'
      });

    if (error) {
      toast({ title: 'Error adding note', description: error.message, variant: 'destructive' });
    } else {
      setNewNote('');
      toast({ title: 'Note added', description: `Added at ${formatTime(currentTime)}` });
    }
  };

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Timestamped Notes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Current: {formatTime(currentTime)}</span>
          </div>
          <Textarea
            placeholder="Add a note at current timestamp..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            rows={3}
          />
          <Button onClick={addNote} className="w-full">
            <Clock className="w-4 h-4 mr-2" />
            Add Note at {formatTime(currentTime)}
          </Button>
        </div>

        <ScrollArea className="h-[400px]">
          <AnimatePresence>
            {notes.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No notes yet. Add one during playback!
              </div>
            ) : (
              notes.map((note) => (
                <motion.div
                  key={note.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-3 mb-2 rounded-lg bg-muted hover:bg-muted/80 cursor-pointer transition-colors"
                  onClick={() => onSeekToTime(note.timestamp)}
                >
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-xs font-mono text-primary font-bold">
                      {formatTime(note.timestamp)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {note.user_name || 'Partner'}
                    </span>
                  </div>
                  <p className="text-sm">{note.content}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(note.created_at).toLocaleString()}
                  </p>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
