import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Heart, Users, Video, VideoOff, Mic, MicOff, X, Copy } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRoom, Room } from '@/hooks/useRoom';
import { toast } from '@/components/ui/use-toast';
import { GlowButton } from './AnimatedUI';
import { FloatingHearts, ConfettiEffect } from './AnimationEffects';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoomCreated: (room: Room) => void;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  isOpen,
  onClose,
  onRoomCreated
}) => {
  const { createRoom, loading } = useRoom();
  const [roomName, setRoomName] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);

  const handleCreate = async () => {
    if (!roomName.trim()) return;
    
    const room = await createRoom(roomName.trim());
    if (room) {
      setShowConfetti(true);
      setTimeout(() => {
        onRoomCreated(room);
        onClose();
        setRoomName('');
        setShowConfetti(false);
      }, 2000);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-center justify-center">
              <Heart className="w-5 h-5 text-pink-500" />
              Create Your Love Room
            </DialogTitle>
          </DialogHeader>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <Card className="border-2 border-dashed border-pink-200 dark:border-pink-800">
              <CardContent className="p-6 text-center">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center"
                >
                  <Heart className="w-8 h-8 text-white fill-current" />
                </motion.div>
                <h3 className="font-semibold mb-2">Your Private Cinema</h3>
                <p className="text-sm text-muted-foreground">
                  Create a magical space where you and your partner can watch movies together, 
                  no matter the distance.
                </p>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Room Name</label>
                <Input
                  placeholder="Our Movie Night 💕"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleCreate()}
                  className="text-center text-lg"
                  maxLength={50}
                />
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={onClose}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <GlowButton
                  onClick={handleCreate}
                  disabled={loading || !roomName.trim()}
                  className="flex-1"
                >
                  {loading ? 'Creating Magic...' : 'Create Room'}
                </GlowButton>
              </div>
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>
      
      <ConfettiEffect isActive={showConfetti} />
    </>
  );
};

interface JoinRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoomJoined: (room: Room) => void;
}

export const JoinRoomModal: React.FC<JoinRoomModalProps> = ({
  isOpen,
  onClose,
  onRoomJoined
}) => {
  const { joinRoom, loading } = useRoom();
  const [roomCode, setRoomCode] = useState('');
  const [showHearts, setShowHearts] = useState(false);

  const handleJoin = async () => {
    if (!roomCode.trim()) return;
    
    const room = await joinRoom(roomCode.trim());
    if (room) {
      setShowHearts(true);
      setTimeout(() => {
        onRoomJoined(room);
        onClose();
        setRoomCode('');
        setShowHearts(false);
      }, 2000);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-center justify-center">
              <Users className="w-5 h-5 text-blue-500" />
              Join Your Partner
            </DialogTitle>
          </DialogHeader>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <Card className="border-2 border-dashed border-blue-200 dark:border-blue-800">
              <CardContent className="p-6 text-center">
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center"
                >
                  <Users className="w-8 h-8 text-white" />
                </motion.div>
                <h3 className="font-semibold mb-2">Connect with Love</h3>
                <p className="text-sm text-muted-foreground">
                  Enter the room code your partner shared to join their cinema.
                </p>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Room Code</label>
                <Input
                  placeholder="ABC123"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
                  className="text-center text-xl font-mono tracking-wider"
                  maxLength={6}
                />
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={onClose}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <GlowButton
                  onClick={handleJoin}
                  disabled={loading || !roomCode.trim()}
                  variant="secondary"
                  className="flex-1"
                >
                  {loading ? 'Connecting...' : 'Join Room'}
                </GlowButton>
              </div>
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>
      
      <FloatingHearts isActive={showHearts} intensity="high" />
    </>
  );
};

interface VideoCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  isConnected: boolean;
}

export const VideoCallModal: React.FC<VideoCallModalProps> = ({
  isOpen,
  onClose,
  roomId,
  isConnected
}) => {
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Video className="w-5 h-5 text-green-500" />
              Video Call
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMinimized(!isMinimized)}
            >
              {isMinimized ? 'Expand' : 'Minimize'}
            </Button>
          </DialogTitle>
        </DialogHeader>

        <motion.div
          animate={{ height: isMinimized ? 100 : 400 }}
          className="space-y-4 overflow-hidden"
        >
          {!isMinimized && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4 h-80"
            >
              {/* Local Video */}
              <Card className="relative overflow-hidden bg-gray-900">
                <CardContent className="p-0 h-full flex items-center justify-center">
                  {isVideoEnabled ? (
                    <div className="text-white text-center">
                      <Video className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm opacity-75">Your Video</p>
                    </div>
                  ) : (
                    <div className="text-white text-center">
                      <VideoOff className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm opacity-75">Video Off</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Partner Video */}
              <Card className="relative overflow-hidden bg-gray-900">
                <CardContent className="p-0 h-full flex items-center justify-center">
                  {isConnected ? (
                    <div className="text-white text-center">
                      <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm opacity-75">Partner's Video</p>
                    </div>
                  ) : (
                    <div className="text-white text-center">
                      <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm opacity-75">Waiting for partner...</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Controls */}
          <div className="flex justify-center gap-4">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsVideoEnabled(!isVideoEnabled)}
              className={`
                w-12 h-12 rounded-full flex items-center justify-center
                ${isVideoEnabled 
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300' 
                  : 'bg-red-500 text-white'
                }
              `}
            >
              {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsAudioEnabled(!isAudioEnabled)}
              className={`
                w-12 h-12 rounded-full flex items-center justify-center
                ${isAudioEnabled 
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300' 
                  : 'bg-red-500 text-white'
                }
              `}
            >
              {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="w-12 h-12 rounded-full bg-red-500 text-white flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </motion.button>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

interface RoomInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room;
}

export const RoomInfoModal: React.FC<RoomInfoModalProps> = ({
  isOpen,
  onClose,
  room
}) => {
  const copyCode = () => {
    navigator.clipboard.writeText(room.room_code);
    toast({
      title: "Copied! 💕",
      description: "Room code copied to clipboard"
    });
  };

  const copyLink = () => {
    const link = `${window.location.origin}/invite/${room.room_code}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Link Copied! ✨",
      description: "Share this magical invite link"
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-center justify-center">
            <Heart className="w-5 h-5 text-pink-500" />
            Room Information
          </DialogTitle>
        </DialogHeader>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <Card className="bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-950 dark:to-purple-950">
            <CardContent className="p-6 text-center space-y-4">
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <h3 className="text-xl font-bold">{room.name}</h3>
              </motion.div>
              
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Room Code</p>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 font-mono text-2xl font-bold tracking-wider">
                  {room.room_code}
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-sm">
                <Users className="w-4 h-4" />
                <span>
                  {room.partner_id ? '2 people connected' : '1 person waiting'}
                </span>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <GlowButton
              onClick={copyCode}
              variant="outline"
              className="flex items-center gap-2 justify-center"
            >
              <Copy className="w-4 h-4" />
              Copy Code
            </GlowButton>
            <GlowButton
              onClick={copyLink}
              className="flex items-center gap-2 justify-center"
            >
              <Heart className="w-4 h-4" />
              Share Link
            </GlowButton>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};