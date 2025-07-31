import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useRoom, Room as RoomType } from '@/hooks/useRoom';
import { useAuth } from '@/hooks/useAuth';
import { MediaPlayer } from '@/components/MediaPlayer';
import { RoomControls } from '@/components/RoomControls';
import { VideoCall } from '@/components/VideoCall';
import { PartnerPresence } from '@/components/PartnerPresence';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Heart } from 'lucide-react';

const Room: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { room, fetchRoom, loading } = useRoom();
  const [currentRoom, setCurrentRoom] = useState<RoomType | null>(null);

  useEffect(() => {
    if (roomId && !authLoading) {
      if (!user) {
        navigate('/auth');
        return;
      }
      fetchRoom(roomId);
    }
  }, [roomId, user, authLoading, fetchRoom, navigate]);

  useEffect(() => {
    if (room) {
      setCurrentRoom(room);
    }
  }, [room]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading room...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to auth
  }

  if (!currentRoom) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Heart className="w-12 h-12 text-muted-foreground mx-auto" />
          <h2 className="text-2xl font-bold">Room not found</h2>
          <p className="text-muted-foreground">
            The room you're looking for doesn't exist or you don't have access to it.
          </p>
          <Button onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-background"
    >
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Button>
        </div>

        {/* Room Controls */}
        <RoomControls room={currentRoom} />

        {/* Partner Presence */}
        {roomId && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <PartnerPresence roomId={roomId} />
          </motion.div>
        )}

        {/* Video Call */}
        {roomId && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <VideoCall roomId={roomId} />
          </motion.div>
        )}

        {/* Media Player */}
        {roomId && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-4"
          >
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Now Watching Together</h3>
              <p className="text-muted-foreground text-sm">
                Playback is automatically synchronized between you and your partner. 
                All play, pause, seek, and buffering events are shared in real-time.
              </p>
            </div>
            <MediaPlayer roomId={roomId} />
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default Room;