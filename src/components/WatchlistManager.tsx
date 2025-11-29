import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Bookmark, Plus, Play, Check, Trash2, Youtube, Link as LinkIcon, Film } from 'lucide-react';

interface WatchlistItem {
  id: string;
  title: string;
  media_url: string;
  media_type: 'youtube' | 'vimeo' | 'url' | 'local';
  thumbnail_url: string | null;
  notes: string | null;
  is_watched: boolean;
  watched_at: string | null;
  added_by: string;
  created_at: string;
}

interface WatchlistManagerProps {
  roomId: string;
  onPlayVideo?: (url: string, type: string) => void;
}

export const WatchlistManager: React.FC<WatchlistManagerProps> = ({ 
  roomId,
  onPlayVideo 
}) => {
  const { user } = useAuth();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filterWatched, setFilterWatched] = useState(false);
  const [newItem, setNewItem] = useState({
    title: '',
    mediaUrl: '',
    notes: ''
  });

  useEffect(() => {
    fetchWatchlist();

    const channel = supabase
      .channel(`watchlist_${roomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'watchlist',
        filter: `room_id=eq.${roomId}`
      }, () => {
        fetchWatchlist();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const fetchWatchlist = async () => {
    try {
      const { data, error } = await supabase
        .from('watchlist')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItems((data || []) as WatchlistItem[]);
    } catch (error) {
      console.error('Failed to fetch watchlist:', error);
    }
  };

  const detectMediaType = (url: string): 'youtube' | 'vimeo' | 'url' => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return 'youtube';
    } else if (url.includes('vimeo.com')) {
      return 'vimeo';
    }
    return 'url';
  };

  const extractYouTubeId = (url: string): string | null => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const getThumbnailUrl = (url: string, type: string): string | null => {
    if (type === 'youtube') {
      const videoId = extractYouTubeId(url);
      return videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : null;
    }
    return null;
  };

  const handleAddItem = async () => {
    if (!user || !newItem.title.trim() || !newItem.mediaUrl.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in title and URL",
        variant: "destructive"
      });
      return;
    }

    try {
      const mediaType = detectMediaType(newItem.mediaUrl);
      const thumbnailUrl = getThumbnailUrl(newItem.mediaUrl, mediaType);

      const { error } = await supabase
        .from('watchlist')
        .insert({
          room_id: roomId,
          title: newItem.title,
          media_url: newItem.mediaUrl,
          media_type: mediaType,
          thumbnail_url: thumbnailUrl,
          notes: newItem.notes || null,
          added_by: user.id
        });

      if (error) throw error;

      toast({
        title: "📌 Added to Watchlist!",
        description: `${newItem.title} saved to watch later`
      });

      setNewItem({ title: '', mediaUrl: '', notes: '' });
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Failed to add item:', error);
      toast({
        title: "Error",
        description: "Failed to add to watchlist",
        variant: "destructive"
      });
    }
  };

  const handleMarkWatched = async (itemId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('watchlist')
        .update({
          is_watched: !currentStatus,
          watched_at: !currentStatus ? new Date().toISOString() : null
        })
        .eq('id', itemId);

      if (error) throw error;

      toast({
        title: !currentStatus ? "✅ Marked as Watched" : "⏮️ Marked as Unwatched",
        description: !currentStatus ? "Great choice!" : "Ready to watch again"
      });
    } catch (error) {
      console.error('Failed to update watch status:', error);
    }
  };

  const handleDelete = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('watchlist')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      toast({
        title: "Removed",
        description: "Item removed from watchlist"
      });
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  };

  const handlePlay = (item: WatchlistItem) => {
    onPlayVideo?.(item.media_url, item.media_type);
    toast({
      title: "▶️ Playing Now",
      description: item.title
    });
  };

  const filteredItems = filterWatched 
    ? items.filter(item => item.is_watched)
    : items;

  const getMediaIcon = (type: string) => {
    switch (type) {
      case 'youtube':
        return <Youtube className="w-4 h-4" />;
      case 'vimeo':
      case 'url':
        return <LinkIcon className="w-4 h-4" />;
      default:
        return <Film className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Bookmark className="w-6 h-6" />
            Watchlist
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Save videos and movies to watch together
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add to Watchlist
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add to Watchlist</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="item-title">Title *</Label>
                <Input
                  id="item-title"
                  value={newItem.title}
                  onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                  placeholder="Movie or video title"
                />
              </div>
              <div>
                <Label htmlFor="item-url">Video URL *</Label>
                <Input
                  id="item-url"
                  value={newItem.mediaUrl}
                  onChange={(e) => setNewItem({ ...newItem, mediaUrl: e.target.value })}
                  placeholder="YouTube, Vimeo, or direct video URL"
                />
              </div>
              <div>
                <Label htmlFor="item-notes">Notes</Label>
                <Textarea
                  id="item-notes"
                  value={newItem.notes}
                  onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
                  placeholder="Why do you want to watch this?"
                />
              </div>
              <Button onClick={handleAddItem} className="w-full">
                Add to Watchlist
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Button
          variant={!filterWatched ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterWatched(false)}
        >
          To Watch ({items.filter(i => !i.is_watched).length})
        </Button>
        <Button
          variant={filterWatched ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterWatched(true)}
        >
          Watched ({items.filter(i => i.is_watched).length})
        </Button>
      </div>

      {/* Watchlist Items */}
      {filteredItems.length === 0 ? (
        <Card className="p-12">
          <div className="text-center text-muted-foreground">
            <Bookmark className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No items in {filterWatched ? 'watched' : 'your watchlist'}</p>
            <p className="text-sm">Add videos you want to watch together!</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filteredItems.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                layout
              >
                <Card className="overflow-hidden group">
                  {/* Thumbnail */}
                  {item.thumbnail_url && (
                    <div className="aspect-video w-full overflow-hidden bg-muted">
                      <img
                        src={item.thumbnail_url}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}

                  {/* Content */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold line-clamp-2">{item.title}</h3>
                      <Badge variant="outline" className="shrink-0">
                        {getMediaIcon(item.media_type)}
                      </Badge>
                    </div>

                    {item.notes && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {item.notes}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handlePlay(item)}
                        className="flex-1"
                      >
                        <Play className="w-3 h-3 mr-1" />
                        Play
                      </Button>
                      <Button
                        size="sm"
                        variant={item.is_watched ? "default" : "outline"}
                        onClick={() => handleMarkWatched(item.id, item.is_watched)}
                      >
                        <Check className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};