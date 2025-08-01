import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRoom, Room } from '@/hooks/useRoom';
import { useAuth } from '@/hooks/useAuth';
import { Copy, Heart, Users, Video, Settings } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { validateRoomName, validateRoomCode, roomRateLimiter } from '@/lib/validation';
import { CreateRoomModal, JoinRoomModal, VideoCallModal, RoomInfoModal } from './ModalOverlays';
import { GlowButton, HoverCard } from './AnimatedUI';
import { PulseEffect, ConnectionStatus } from './AnimationEffects';

interface RoomControlsProps {
  room?: Room | null;
  onRoomJoined?: (room: Room) => void;
  onRoomCreated?: (room: Room) => void;
}

export const RoomControls: React.FC<RoomControlsProps> = ({
  room,
  onRoomJoined,
  onRoomCreated
}) => {
  const { user } = useAuth();
  const { loading } = useRoom();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  const handleRoomCreated = (newRoom: Room) => {
    onRoomCreated?.(newRoom);
  };

  const handleRoomJoined = (joinedRoom: Room) => {
    onRoomJoined?.(joinedRoom);
  };

  const copyRoomCode = () => {
    if (room?.room_code) {
      navigator.clipboard.writeText(room.room_code);
      toast({
        title: "Copied! 💕",
        description: "Room code copied to clipboard"
      });
    }
  };

  const copyRoomLink = () => {
    if (room?.room_code) {
      const inviteLink = `${window.location.origin}/invite/${room.room_code}`;
      navigator.clipboard.writeText(inviteLink);
      toast({
        title: "Invite Link Copied! 💕",
        description: "Share this beautiful invite link with your partner"
      });
    }
  };

  if (!user) {
    return (
      <HoverCard className="w-full max-w-md mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-pink-500" />
              UsTwo
            </CardTitle>
            <CardDescription>
              Please sign in to create or join a room
            </CardDescription>
          </CardHeader>
        </Card>
      </HoverCard>
    );
  }

  if (room) {
    return (
      <>
        <ConnectionStatus 
          isConnected={!!room.partner_id} 
          isWatching={true}
        />
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl mx-auto"
        >
          <PulseEffect isActive={!!room.partner_id}>
            <HoverCard>
              <Card className="border-2 border-pink-200 dark:border-pink-800">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Heart className="w-5 h-5 text-pink-500 fill-current" />
                      {room.name}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="w-4 h-4" />
                      {room.partner_id ? '2 connected' : '1 waiting'}
                    </div>
                  </CardTitle>
                  <CardDescription>
                    Room Code: <span className="font-mono font-bold text-primary">{room.room_code}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <GlowButton
                      onClick={copyRoomCode}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2 justify-center"
                    >
                      <Copy className="w-4 h-4" />
                      Copy Code
                    </GlowButton>
                    <GlowButton
                      onClick={copyRoomLink}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2 justify-center"
                    >
                      <Heart className="w-4 h-4" />
                      Share Link
                    </GlowButton>
                    <GlowButton
                      onClick={() => setShowVideoModal(true)}
                      variant="secondary"
                      size="sm"
                      className="flex items-center gap-2 justify-center"
                    >
                      <Video className="w-4 h-4" />
                      Video Call
                    </GlowButton>
                    <GlowButton
                      onClick={() => setShowInfoModal(true)}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2 justify-center"
                    >
                      <Settings className="w-4 h-4" />
                      Room Info
                    </GlowButton>
                  </div>
                  
                  {!room.partner_id && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-4 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-950 dark:to-purple-950 rounded-lg border border-dashed border-pink-300 dark:border-pink-700"
                    >
                      <div className="text-center space-y-2">
                        <motion.div
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <Heart className="w-6 h-6 mx-auto text-pink-500 fill-current" />
                        </motion.div>
                        <p className="text-sm font-medium">Waiting for your partner...</p>
                        <p className="text-xs text-muted-foreground">
                          Share the room code or link to start watching together!
                        </p>
                      </div>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </HoverCard>
          </PulseEffect>
        </motion.div>

        <VideoCallModal 
          isOpen={showVideoModal}
          onClose={() => setShowVideoModal(false)}
          roomId={room.id}
          isConnected={!!room.partner_id}
        />

        <RoomInfoModal 
          isOpen={showInfoModal}
          onClose={() => setShowInfoModal(false)}
          room={room}
        />
      </>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md mx-auto space-y-4"
      >
        <HoverCard>
          <Card className="border-2 border-dashed border-primary/20 hover:border-primary/40 transition-colors">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Heart className="w-6 h-6 text-pink-500 fill-current" />
                </motion.div>
                Welcome to UsTwo
              </CardTitle>
              <CardDescription>
                Create a private room to watch together with your partner
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <GlowButton 
                onClick={() => setShowCreateModal(true)}
                className="w-full"
                size="lg"
              >
                Create Room
              </GlowButton>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-dashed" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    or
                  </span>
                </div>
              </div>

              <GlowButton 
                onClick={() => setShowJoinModal(true)}
                variant="secondary" 
                className="w-full" 
                size="lg"
              >
                Join Room
              </GlowButton>
            </CardContent>
          </Card>
        </HoverCard>
      </motion.div>

      <CreateRoomModal 
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onRoomCreated={handleRoomCreated}
      />

      <JoinRoomModal 
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onRoomJoined={handleRoomJoined}
      />
    </>
  );
};