import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useRoom, Room } from '@/hooks/useRoom';
import { RoomControls } from '@/components/RoomControls';
import { Button } from '@/components/ui/button';
import { Heart, LogOut } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();
  const { user, signOut, loading } = useAuth();
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const handleRoomCreated = (room: Room) => {
    setCurrentRoom(room);
    navigate(`/room/${room.id}`);
  };

  const handleRoomJoined = (room: Room) => {
    setCurrentRoom(room);
    navigate(`/room/${room.id}`);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to auth
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 dark:from-gray-900 dark:to-gray-800"
    >
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-12"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
              <Heart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
                UsTwo
              </h1>
              <p className="text-sm text-muted-foreground">
                Watch together, stay connected
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Welcome, {user.email}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        </motion.div>

        {/* Main Content */}
        <div className="flex flex-col items-center justify-center space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center space-y-4 max-w-2xl"
          >
            <h2 className="text-4xl font-bold text-foreground">
              Create Your Private Cinema
            </h2>
            <p className="text-xl text-muted-foreground">
              Share movies, TV shows, and special moments with your partner in real-time. 
              Perfect for long-distance relationships and cozy nights together.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="w-full max-w-md"
          >
            <RoomControls
              room={currentRoom}
              onRoomCreated={handleRoomCreated}
              onRoomJoined={handleRoomJoined}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-center space-y-4"
          >
            <h3 className="text-lg font-semibold">How it works</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-pink-100 dark:bg-pink-900 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-pink-600 dark:text-pink-400 font-bold">1</span>
                </div>
                <h4 className="font-medium">Create or Join</h4>
                <p className="text-sm text-muted-foreground">
                  One partner creates a room, the other joins with the code
                </p>
              </div>
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-purple-600 dark:text-purple-400 font-bold">2</span>
                </div>
                <h4 className="font-medium">Watch Together</h4>
                <p className="text-sm text-muted-foreground">
                  Video playback automatically syncs between both of you
                </p>
              </div>
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-pink-100 dark:bg-pink-900 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-pink-600 dark:text-pink-400 font-bold">3</span>
                </div>
                <h4 className="font-medium">Stay Connected</h4>
                <p className="text-sm text-muted-foreground">
                  Optional video calls and real-time reactions
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

export default Index;
