import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Plus, Play, Trash2, MoveUp, MoveDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface QueueItem {
  id: string;
  url: string;
  title: string;
  type: 'youtube' | 'vimeo' | 'url';
  position: number;
  added_by: string;
}

interface VideoQueueProps {
  roomId: string;
  onPlayVideo: (url: string, type: string) => void;
  currentVideoUrl?: string;
}

export const VideoQueue: React.FC<VideoQueueProps> = ({ roomId, onPlayVideo, currentVideoUrl }) => {
  const { user } = useAuth();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [newTitle, setNewTitle] = useState('');

  useEffect(() => {
    fetchQueue();
    
    const channel = supabase
      .channel(`queue:${roomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'video_queue',
        filter: `room_id=eq.${roomId}`
      }, () => {
        fetchQueue();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const fetchQueue = async () => {
    const { data, error } = await supabase
      .from('video_queue')
      .select('*')
      .eq('room_id', roomId)
      .order('position', { ascending: true });

    if (!error && data) {
      setQueue(data as QueueItem[]);
    }
  };

  const detectVideoType = (url: string): { type: 'youtube' | 'vimeo' | 'url', id: string } => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/);
      return { type: 'youtube', id: match?.[1] || url };
    }
    if (url.includes('vimeo.com')) {
      const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
      return { type: 'vimeo', id: match?.[1] || url };
    }
    return { type: 'url', id: url };
  };

  const addToQueue = async () => {
    if (!newUrl.trim() || !user) return;

    const { type, id } = detectVideoType(newUrl);
    const maxPosition = queue.length > 0 ? Math.max(...queue.map(q => q.position)) : 0;

    const { error } = await supabase
      .from('video_queue')
      .insert({
        room_id: roomId,
        url: id,
        title: newTitle || `Video ${queue.length + 1}`,
        type,
        position: maxPosition + 1,
        added_by: user.id
      });

    if (error) {
      toast({ title: 'Error adding to queue', description: error.message, variant: 'destructive' });
    } else {
      setNewUrl('');
      setNewTitle('');
      toast({ title: 'Added to queue', description: 'Video added successfully' });
    }
  };

  const removeFromQueue = async (id: string) => {
    const { error } = await supabase
      .from('video_queue')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: 'Error removing video', description: error.message, variant: 'destructive' });
    }
  };

  const moveVideo = async (id: string, direction: 'up' | 'down') => {
    const index = queue.findIndex(q => q.id === id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === queue.length - 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const newQueue = [...queue];
    [newQueue[index], newQueue[newIndex]] = [newQueue[newIndex], newQueue[index]];

    for (let i = 0; i < newQueue.length; i++) {
      await supabase
        .from('video_queue')
        .update({ position: i })
        .eq('id', newQueue[i].id);
    }
  };

  const playNext = async () => {
    if (queue.length === 0) return;
    const next = queue[0];
    onPlayVideo(next.url, next.type);
    await removeFromQueue(next.id);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          📋 Video Queue ({queue.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Input
            placeholder="Video URL (YouTube, Vimeo, or direct link)"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
          />
          <Input
            placeholder="Video title (optional)"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <Button onClick={addToQueue} className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Add to Queue
          </Button>
        </div>

        {queue.length > 0 && (
          <Button onClick={playNext} className="w-full" variant="secondary">
            <Play className="w-4 h-4 mr-2" />
            Play Next ({queue[0]?.title})
          </Button>
        )}

        <ScrollArea className="h-[300px]">
          <AnimatePresence>
            {queue.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className={`p-3 mb-2 rounded-lg border ${
                  currentVideoUrl === item.url ? 'bg-primary/10 border-primary' : 'bg-muted'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.type.toUpperCase()}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => moveVideo(item.id, 'up')}
                      disabled={index === 0}
                    >
                      <MoveUp className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => moveVideo(item.id, 'down')}
                      disabled={index === queue.length - 1}
                    >
                      <MoveDown className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onPlayVideo(item.url, item.type)}
                    >
                      <Play className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeFromQueue(item.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
