import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotes } from '@/hooks/useNotes';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { MessageCircle, Send, Heart, MessageSquare, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface NotesTimelineProps {
  partnerId?: string;
}

export const NotesTimeline: React.FC<NotesTimelineProps> = ({ partnerId }) => {
  const { user } = useAuth();
  const { notes, loading, sendNote, markAsRead, unreadCount } = useNotes(partnerId);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newNote, setNewNote] = useState('');

  const handleSendNote = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newNote.trim() || !partnerId) return;

    const result = await sendNote(newNote.trim(), partnerId);
    
    if (result) {
      setNewNote('');
      setIsDialogOpen(false);
    }
  };

  const handleNoteClick = (note: any) => {
    if (note.receiver_id === user?.id && !note.is_read) {
      markAsRead(note.id);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <Card className="border-pink-200 dark:border-pink-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-pink-500" />
            Love Notes & Memories
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount}
              </Badge>
            )}
          </CardTitle>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-to-r from-pink-500 to-purple-600">
                <Plus className="w-4 h-4 mr-2" />
                Write Note
              </Button>
            </DialogTrigger>
            
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send a Love Note 💕</DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handleSendNote} className="space-y-4">
                <Textarea
                  placeholder="Write a sweet message, memory, or just say how much you love them..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  rows={4}
                  className="resize-none"
                  required
                />
                
                <Button type="submit" className="w-full" disabled={!newNote.trim()}>
                  <Send className="w-4 h-4 mr-2" />
                  Send Love Note
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : notes.length > 0 ? (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            <AnimatePresence>
              {notes.map((note, index) => {
                const isFromMe = note.sender_id === user?.id;
                const isUnread = note.receiver_id === user?.id && !note.is_read;
                
                return (
                  <motion.div
                    key={note.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.05 }}
                    className={`flex ${isFromMe ? 'justify-end' : 'justify-start'}`}
                    onClick={() => handleNoteClick(note)}
                  >
                    <div className={`max-w-[80%] ${isFromMe ? 'order-2' : 'order-1'}`}>
                      <div
                        className={`p-4 rounded-2xl relative ${
                          isFromMe
                            ? 'bg-gradient-to-br from-pink-500 to-purple-600 text-white'
                            : `bg-gray-100 dark:bg-gray-800 ${isUnread ? 'ring-2 ring-pink-500 ring-opacity-50' : ''}`
                        }`}
                      >
                        <p className="text-sm leading-relaxed">{note.content}</p>
                        
                        <div className={`flex items-center justify-between mt-2 text-xs ${
                          isFromMe ? 'text-pink-100' : 'text-muted-foreground'
                        }`}>
                          <span>{formatTimeAgo(note.created_at)}</span>
                          
                          {isUnread && !isFromMe && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              New
                            </Badge>
                          )}
                          
                          {isFromMe && (
                            <Heart className="w-3 h-3 fill-current" />
                          )}
                        </div>
                        
                        {/* Message tail */}
                        <div
                          className={`absolute top-4 w-3 h-3 transform rotate-45 ${
                            isFromMe
                              ? 'right-[-6px] bg-purple-600'
                              : 'left-[-6px] bg-gray-100 dark:bg-gray-800'
                          }`}
                        />
                      </div>
                    </div>
                    
                    <div className={`flex items-end ${isFromMe ? 'order-1 mr-2' : 'order-2 ml-2'}`}>
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className={`text-xs ${
                          isFromMe ? 'bg-pink-100 text-pink-600' : 'bg-purple-100 text-purple-600'
                        }`}>
                          {isFromMe ? 'Me' : '💕'}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No notes yet</p>
            <p className="text-sm">Start your love story timeline!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};