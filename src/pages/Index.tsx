import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useRoom, Room } from '@/hooks/useRoom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  Heart, 
  LogOut, 
  Play, 
  Users, 
  Sparkles, 
  Video, 
  Calendar, 
  MessageSquare,
  Plus,
  ArrowRight,
  Zap,
  Shield,
  Clock
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const Index = () => {
  const navigate = useNavigate();
  const { user, signOut, loading } = useAuth();
  const { createRoom, joinRoom, loading: roomLoading } = useRoom();
  const [roomCode, setRoomCode] = useState('');
  const [roomName, setRoomName] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const handleCreateRoom = async () => {
    if (!roomName.trim()) {
      toast({ title: 'Please enter a room name', variant: 'destructive' });
      return;
    }
    const room = await createRoom(roomName);
    if (room) {
      navigate(`/room/${room.id}`);
    }
  };

  const handleJoinRoom = async () => {
    if (!roomCode.trim()) {
      toast({ title: 'Please enter a room code', variant: 'destructive' });
      return;
    }
    const room = await joinRoom(roomCode);
    if (room) {
      navigate(`/room/${room.id}`);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-4"
        >
          <div className="w-16 h-16 mx-auto">
            <Heart className="w-full h-full text-primary animate-heart-beat" fill="currentColor" />
          </div>
          <p className="text-muted-foreground">Loading your space...</p>
        </motion.div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-love-purple/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-love-coral/3 rounded-full blur-3xl" />
      </div>

      {/* Navigation Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-50 glass border-b"
      >
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-romantic flex items-center justify-center">
              <Heart className="w-5 h-5 text-white" fill="white" />
            </div>
            <span className="text-xl font-bold text-gradient">UsTwo</span>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:block">
              {user.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </motion.header>

      {/* Hero Section */}
      <main className="container mx-auto px-6 py-12 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-4xl mx-auto mb-16"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-accent-foreground mb-6"
          >
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium">Watch Together, Feel Together</span>
          </motion.div>
          
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 tracking-tight">
            Your Private
            <span className="text-gradient"> Cinema </span>
            for Two
          </h1>
          
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
            Stream movies and shows in perfect sync with your partner. 
            Video call while you watch. Stay connected, no matter the distance.
          </p>
        </motion.div>

        {/* Action Cards */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-20"
        >
          {/* Create Room Card */}
          <Card className="p-6 card-hover border-2 border-dashed hover:border-primary/50 group">
            {!showCreate ? (
              <button 
                onClick={() => setShowCreate(true)}
                className="w-full text-left space-y-4"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-romantic flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Plus className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Create a Room</h3>
                  <p className="text-muted-foreground text-sm">
                    Start a private cinema session and invite your partner
                  </p>
                </div>
                <div className="flex items-center gap-2 text-primary font-medium">
                  <span>Get Started</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            ) : (
              <div className="space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-romantic flex items-center justify-center">
                  <Plus className="w-7 h-7 text-white" />
                </div>
                <Input
                  placeholder="Room name (e.g., Movie Night)"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="h-12"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateRoom()}
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowCreate(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateRoom}
                    disabled={roomLoading}
                    className="flex-1 bg-gradient-romantic hover:opacity-90"
                  >
                    {roomLoading ? 'Creating...' : 'Create'}
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* Join Room Card */}
          <Card className="p-6 card-hover border-2 hover:border-primary/50 group">
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center group-hover:scale-110 transition-transform">
                <Users className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Join a Room</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Enter your partner's room code to join
                </p>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter room code"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  className="h-12 font-mono text-center tracking-widest"
                  maxLength={8}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                />
                <Button
                  onClick={handleJoinRoom}
                  disabled={roomLoading || !roomCode.trim()}
                  className="h-12 px-6"
                >
                  Join
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mb-20"
        >
          <h2 className="text-2xl font-bold text-center mb-10">Everything You Need</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
            {[
              {
                icon: Play,
                title: 'Synced Playback',
                desc: 'YouTube, Vimeo, local files - all in perfect sync',
                color: 'text-primary'
              },
              {
                icon: Video,
                title: 'Video Calls',
                desc: 'See each other while watching together',
                color: 'text-love-purple'
              },
              {
                icon: Sparkles,
                title: 'AI Recommendations',
                desc: 'Smart suggestions based on both your tastes',
                color: 'text-love-coral'
              },
              {
                icon: Heart,
                title: 'Love Meter',
                desc: 'Track your time together and memories',
                color: 'text-love-rose'
              },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + i * 0.1 }}
              >
                <Card className="p-5 h-full card-hover">
                  <feature.icon className={`w-8 h-8 mb-3 ${feature.color}`} />
                  <h3 className="font-semibold mb-1">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.desc}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* How it works */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="max-w-4xl mx-auto"
        >
          <h2 className="text-2xl font-bold text-center mb-10">How It Works</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '1', title: 'Create', desc: 'Start a room and get your unique code', icon: Zap },
              { step: '2', title: 'Share', desc: 'Send the code to your partner', icon: MessageSquare },
              { step: '3', title: 'Watch', desc: 'Enjoy movies in perfect sync', icon: Play },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 + i * 0.1 }}
                className="text-center"
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-romantic flex items-center justify-center text-white font-bold text-2xl">
                  {item.step}
                </div>
                <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-card/50 mt-20">
        <div className="container mx-auto px-6 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-primary" fill="currentColor" />
              <span className="font-semibold">UsTwo</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Watch together, feel together. Made with ❤️ for couples.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
