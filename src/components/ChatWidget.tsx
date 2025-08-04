import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  MessageCircle, 
  Send, 
  Smile, 
  Heart, 
  ThumbsUp,
  Laugh,
  AlertCircle,
  X,
  Minimize2
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';

interface ChatMessage {
  id: string;
  content: string;
  sender_id: string;
  sender_email: string;
  type: 'message' | 'emoji' | 'reaction';
  created_at: string;
}

interface ChatWidgetProps {
  roomId: string;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
}

const EMOJI_REACTIONS = [
  { emoji: '❤️', icon: Heart, label: 'Love' },
  { emoji: '👍', icon: ThumbsUp, label: 'Like' },
  { emoji: '😂', icon: Laugh, label: 'Laugh' },
  { emoji: '😮', icon: AlertCircle, label: 'Wow' },
  { emoji: '🔥', icon: null, label: 'Fire' },
  { emoji: '🎉', icon: null, label: 'Party' }
];

export const ChatWidget: React.FC<ChatWidgetProps> = ({
  roomId,
  isMinimized = false,
  onToggleMinimize
}) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!roomId || !user) return;

    // Subscribe to new messages
    const channel = supabase
      .channel(`chat_${roomId}`)
      .on('broadcast', { event: 'new_message' }, (payload) => {
        const message = payload.payload as ChatMessage;
        setMessages(prev => [...prev, message]);
        
        // Increment unread count if chat is closed and message is not from current user
        if (!isOpen && message.sender_id !== user.id) {
          setUnreadCount(prev => prev + 1);
        }
        
        // Show toast for reactions
        if (message.type === 'emoji' || message.type === 'reaction') {
          if (message.sender_id !== user.id) {
            toast({
              title: "Reaction from partner",
              description: message.content,
              duration: 2000
            });
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, user, isOpen]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // Reset unread count when chat is opened
    if (isOpen) {
      setUnreadCount(0);
    }
  }, [isOpen]);

  const sendMessage = async (content: string, type: 'message' | 'emoji' | 'reaction' = 'message') => {
    if (!content.trim() || !user) return;

    const message: ChatMessage = {
      id: `msg_${Date.now()}`,
      content: content.trim(),
      sender_id: user.id,
      sender_email: user.email || 'Unknown',
      type,
      created_at: new Date().toISOString()
    };

    // Add to local state immediately
    setMessages(prev => [...prev, message]);

    // Broadcast to other users
    const channel = supabase.channel(`chat_${roomId}`);
    await channel.send({
      type: 'broadcast',
      event: 'new_message',
      payload: message
    });

    setNewMessage('');
  };

  const sendEmoji = (emoji: string) => {
    sendMessage(emoji, 'emoji');
    setShowEmojiPicker(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(newMessage);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (isMinimized) {
    return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="fixed bottom-4 right-4 z-50"
      >
        <Button
          onClick={() => {
            setIsOpen(true);
            onToggleMinimize?.();
          }}
          className="w-14 h-14 rounded-full relative"
          size="lg"
        >
          <MessageCircle className="w-6 h-6" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </motion.div>
    );
  }

  if (!isOpen) {
    return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="fixed bottom-4 right-4 z-50"
      >
        <Button
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 rounded-full relative"
          size="lg"
        >
          <MessageCircle className="w-6 h-6" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className="fixed bottom-4 right-4 z-50 w-80 h-96"
    >
      <Card className="h-full flex flex-col shadow-xl">
        <CardHeader className="p-3 pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              Chat
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="h-6 w-6 p-0"
              >
                <Smile className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsOpen(false);
                  onToggleMinimize?.();
                }}
                className="h-6 w-6 p-0"
              >
                <Minimize2 className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-6 w-6 p-0"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Emoji Picker */}
        <AnimatePresence>
          {showEmojiPicker && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-3 pb-2"
            >
              <div className="flex gap-1 p-2 bg-muted rounded-lg">
                {EMOJI_REACTIONS.map((reaction) => (
                  <Button
                    key={reaction.emoji}
                    variant="ghost"
                    size="sm"
                    onClick={() => sendEmoji(reaction.emoji)}
                    className="h-8 w-8 p-0 text-lg hover:scale-110 transition-transform"
                    title={reaction.label}
                  >
                    {reaction.emoji}
                  </Button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <CardContent className="flex-1 p-3 pt-0">
          <ScrollArea className="h-full pr-2" ref={scrollAreaRef}>
            <div className="space-y-2">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-8">
                  <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Start chatting with your partner!</p>
                </div>
              ) : (
                messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] p-2 rounded-lg text-sm ${
                        message.sender_id === user?.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      } ${
                        message.type === 'emoji' || message.type === 'reaction'
                          ? 'text-2xl py-1 px-2'
                          : ''
                      }`}
                    >
                      <div>{message.content}</div>
                      <div 
                        className={`text-xs mt-1 opacity-70 ${
                          message.sender_id === user?.id ? 'text-right' : 'text-left'
                        }`}
                      >
                        {formatTime(message.created_at)}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <form onSubmit={handleSubmit} className="flex gap-2 mt-3">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1"
              maxLength={200}
            />
            <Button type="submit" size="sm" disabled={!newMessage.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
};