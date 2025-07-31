import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useRoom } from '@/hooks/useRoom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Heart, Users, Play, Star, Sparkles } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const Invite: React.FC = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { joinRoom, loading } = useRoom();
  const [isJoining, setIsJoining] = useState(false);

  const handleJoinRoom = async () => {
    if (!user || !roomCode) {
      navigate('/auth');
      return;
    }

    setIsJoining(true);
    const result = await joinRoom(roomCode);
    
    if (result) {
      toast({
        title: "Welcome to the room! 💕",
        description: "Get ready for an amazing watch session together!"
      });
      navigate(`/room/${result.id}`);
    }
    setIsJoining(false);
  };

  // Floating hearts animation
  const FloatingHeart = ({ delay = 0 }: { delay?: number }) => (
    <motion.div
      className="absolute text-pink-300 text-opacity-40"
      initial={{ y: 100, opacity: 0, scale: 0 }}
      animate={{ 
        y: -100, 
        opacity: [0, 1, 0],
        scale: [0, 1, 0.8],
        x: [0, 30, -20, 0]
      }}
      transition={{ 
        duration: 4, 
        repeat: Infinity, 
        delay,
        ease: "easeInOut"
      }}
      style={{
        left: `${20 + Math.random() * 60}%`,
        fontSize: `${1 + Math.random() * 1.5}rem`
      }}
    >
      💕
    </motion.div>
  );

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-100 via-purple-50 to-indigo-100">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-50 to-indigo-100 dark:from-pink-900/20 dark:via-purple-900/20 dark:to-indigo-900/20 relative overflow-hidden">
      {/* Floating Hearts Background */}
      {[...Array(8)].map((_, i) => (
        <FloatingHeart key={i} delay={i * 0.8} />
      ))}
      
      {/* Sparkle Effects */}
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            scale: [0, 1, 0],
            rotate: [0, 180, 360],
            opacity: [0, 1, 0]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: i * 0.3,
            ease: "easeInOut"
          }}
        >
          <Sparkles className="w-4 h-4 text-yellow-300" />
        </motion.div>
      ))}

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          <Card className="border-0 shadow-2xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm">
            <CardContent className="p-8 text-center space-y-6">
              {/* Animated Logo */}
              <motion.div
                className="relative"
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <div className="w-20 h-20 bg-gradient-to-br from-pink-500 via-purple-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Heart className="w-10 h-10 text-white fill-current" />
                  </motion.div>
                </div>
                
                {/* Pulse rings */}
                {[...Array(3)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute top-0 left-1/2 transform -translate-x-1/2 w-20 h-20 border-2 border-pink-300 rounded-full"
                    animate={{ scale: [1, 2, 2.5], opacity: [0.7, 0.3, 0] }}
                    transition={{ 
                      duration: 2, 
                      repeat: Infinity, 
                      delay: i * 0.6,
                      ease: "easeOut"
                    }}
                  />
                ))}
              </motion.div>

              {/* Title */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="space-y-2"
              >
                <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-600 via-purple-600 to-red-600 bg-clip-text text-transparent">
                  You're Invited! 💕
                </h1>
                <p className="text-lg text-muted-foreground">
                  Someone special wants to watch together
                </p>
              </motion.div>

              {/* Features */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col items-center gap-2 p-3 bg-pink-50 dark:bg-pink-900/20 rounded-lg">
                    <Users className="w-6 h-6 text-pink-500" />
                    <span className="text-sm font-medium">Watch Together</span>
                  </div>
                  
                  <div className="flex flex-col items-center gap-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <Play className="w-6 h-6 text-purple-500" />
                    <span className="text-sm font-medium">Perfect Sync</span>
                  </div>
                  
                  <div className="flex flex-col items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <Heart className="w-6 h-6 text-red-500 fill-current" />
                    <span className="text-sm font-medium">Video Chat</span>
                  </div>
                  
                  <div className="flex flex-col items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <Star className="w-6 h-6 text-yellow-500" />
                    <span className="text-sm font-medium">Love Stats</span>
                  </div>
                </div>
              </motion.div>

              {/* Room Code Display */}
              {roomCode && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.7 }}
                  className="p-4 bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg"
                >
                  <p className="text-sm text-muted-foreground mb-1">Room Code</p>
                  <p className="text-2xl font-mono font-bold tracking-wider text-indigo-600">
                    {roomCode}
                  </p>
                </motion.div>
              )}

              {/* Action Button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                className="space-y-3"
              >
                {user ? (
                  <Button
                    onClick={handleJoinRoom}
                    disabled={loading || isJoining}
                    className="w-full py-6 text-lg bg-gradient-to-r from-pink-500 via-purple-500 to-red-500 hover:from-pink-600 hover:via-purple-600 hover:to-red-600 shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    {isJoining ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Joining Room...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Heart className="w-5 h-5 fill-current" />
                        Join the Love Session
                      </div>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={() => navigate('/auth')}
                    className="w-full py-6 text-lg bg-gradient-to-r from-pink-500 via-purple-500 to-red-500 hover:from-pink-600 hover:via-purple-600 hover:to-red-600 shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    <div className="flex items-center gap-2">
                      <Heart className="w-5 h-5 fill-current" />
                      Sign In to Join
                    </div>
                  </Button>
                )}

                <p className="text-xs text-muted-foreground">
                  Experience the magic of synchronized watching
                </p>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default Invite;