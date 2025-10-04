import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useRoom, Room } from '@/hooks/useRoom';
import { RoomControls } from '@/components/RoomControls';
import { Button } from '@/components/ui/button';
import { Heart, LogOut, Video, Users, Sparkles } from 'lucide-react';

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
      className="min-h-screen bg-background"
    >
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-12"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-love-pink to-love-purple rounded-full flex items-center justify-center shadow-lg">
              <Heart className="w-7 h-7 text-white" fill="white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-love-pink to-love-purple bg-clip-text text-transparent">
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
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center space-y-6 mb-12"
          >
            <h2 className="text-5xl font-bold text-foreground">
              Your Private Cinema Awaits
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Share movies, TV shows, and special moments with your partner in real-time. 
              Perfect for long-distance relationships and cozy nights together.
            </p>
          </motion.div>

          {/* Room Controls - Main Focus */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="mb-12"
          >
            <RoomControls
              room={currentRoom}
              onRoomCreated={handleRoomCreated}
              onRoomJoined={handleRoomJoined}
            />
          </motion.div>

          {/* Features Grid */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            <div className="p-6 rounded-lg border border-border bg-card hover:shadow-lg transition-shadow">
              <Video className="w-10 h-10 mb-4 text-love-pink" />
              <h3 className="font-semibold mb-2">Synced Playback</h3>
              <p className="text-sm text-muted-foreground">
                Watch videos perfectly synchronized with your partner. Supports YouTube, Vimeo, and local files.
              </p>
            </div>
            
            <div className="p-6 rounded-lg border border-border bg-card hover:shadow-lg transition-shadow">
              <Users className="w-10 h-10 mb-4 text-love-purple" />
              <h3 className="font-semibold mb-2">Video Calls</h3>
              <p className="text-sm text-muted-foreground">
                See and talk to each other while watching. Stable, high-quality WebRTC video calls.
              </p>
            </div>
            
            <div className="p-6 rounded-lg border border-border bg-card hover:shadow-lg transition-shadow">
              <Sparkles className="w-10 h-10 mb-4 text-love-pink" />
              <h3 className="font-semibold mb-2">AI Recommendations</h3>
              <p className="text-sm text-muted-foreground">
                Get personalized movie suggestions based on both your preferences and watch history.
              </p>
            </div>
          </motion.div>

          {/* How it works */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-16 text-center space-y-8"
          >
            <h3 className="text-2xl font-bold">How It Works</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-3">
                <div className="w-16 h-16 bg-gradient-to-br from-love-pink to-love-purple rounded-full flex items-center justify-center mx-auto text-white font-bold text-xl">
                  1
                </div>
                <h4 className="font-medium text-lg">Create or Join</h4>
                <p className="text-sm text-muted-foreground">
                  One partner creates a room and shares the code. The other joins instantly.
                </p>
              </div>
              
              <div className="space-y-3">
                <div className="w-16 h-16 bg-gradient-to-br from-love-purple to-love-pink rounded-full flex items-center justify-center mx-auto text-white font-bold text-xl">
                  2
                </div>
                <h4 className="font-medium text-lg">Watch Together</h4>
                <p className="text-sm text-muted-foreground">
                  Upload videos, paste links, or use OTT platforms. Everything syncs automatically.
                </p>
              </div>
              
              <div className="space-y-3">
                <div className="w-16 h-16 bg-gradient-to-br from-love-pink to-love-purple rounded-full flex items-center justify-center mx-auto text-white font-bold text-xl">
                  3
                </div>
                <h4 className="font-medium text-lg">Stay Connected</h4>
                <p className="text-sm text-muted-foreground">
                  Video call, chat, react with hearts, and track your memories together.
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
