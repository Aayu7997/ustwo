import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useRoom, Room } from '@/hooks/useRoom';
import { useAuth } from '@/hooks/useAuth';
import { Copy, Heart, Users, Video } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

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
  const { createRoom, joinRoom, loading } = useRoom();
  const [roomName, setRoomName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);

  const handleCreateRoom = async () => {
    if (!roomName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a room name",
        variant: "destructive"
      });
      return;
    }

    const newRoom = await createRoom(roomName);
    if (newRoom) {
      setShowCreateDialog(false);
      setRoomName('');
      onRoomCreated?.(newRoom);
    }
  };

  const handleJoinRoom = async () => {
    if (!joinCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter a room code",
        variant: "destructive"
      });
      return;
    }

    const joinedRoom = await joinRoom(joinCode);
    if (joinedRoom) {
      setShowJoinDialog(false);
      setJoinCode('');
      onRoomJoined?.(joinedRoom);
    }
  };

  const copyRoomCode = () => {
    if (room?.room_code) {
      navigator.clipboard.writeText(room.room_code);
      toast({
        title: "Copied!",
        description: "Room code copied to clipboard"
      });
    }
  };

  const copyRoomLink = () => {
    if (room?.id) {
      const link = `${window.location.origin}/room/${room.id}`;
      navigator.clipboard.writeText(link);
      toast({
        title: "Copied!",
        description: "Room link copied to clipboard"
      });
    }
  };

  if (!user) {
    return (
      <Card className="w-full max-w-md mx-auto">
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
    );
  }

  if (room) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl mx-auto"
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-pink-500" />
                {room.name}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="w-4 h-4" />
                {room.partner_id ? '2 connected' : '1 waiting'}
              </div>
            </CardTitle>
            <CardDescription>
              Room Code: <span className="font-mono font-bold">{room.room_code}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={copyRoomCode}
                className="flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy Code
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={copyRoomLink}
                className="flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy Link
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
                disabled
              >
                <Video className="w-4 h-4" />
                Video Call (Coming Soon)
              </Button>
            </div>
            
            {!room.partner_id && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Waiting for your partner to join... Share the room code or link with them!
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md mx-auto space-y-4"
    >
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <Heart className="w-6 h-6 text-pink-500" />
            Welcome to UsTwo
          </CardTitle>
          <CardDescription>
            Create a private room to watch together with your partner
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="w-full" size="lg">
                Create Room
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a New Room</DialogTitle>
                <DialogDescription>
                  Give your room a romantic name that you and your partner will recognize
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Enter room name (e.g., 'Our Movie Night')"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateRoom()}
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowCreateDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleCreateRoom}
                    disabled={loading || !roomName.trim()}
                  >
                    {loading ? 'Creating...' : 'Create Room'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                or
              </span>
            </div>
          </div>

          <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full" size="lg">
                Join Room
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Join Your Partner's Room</DialogTitle>
                <DialogDescription>
                  Enter the room code your partner shared with you
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Enter room code (e.g., ABC123)"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
                  className="font-mono text-center text-lg tracking-widest"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowJoinDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleJoinRoom}
                    disabled={loading || !joinCode.trim()}
                  >
                    {loading ? 'Joining...' : 'Join Room'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </motion.div>
  );
};