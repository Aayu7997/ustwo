import React from 'react';
import { motion } from 'framer-motion';
import { StableVideoCallOverlay } from '@/components/StableVideoCallOverlay';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Video, Phone, Shield, Wifi } from 'lucide-react';

interface CallTabProps {
  roomId: string;
  roomCode?: string;
  partnerId?: string | null;
  partnerName?: string;
}

export const CallTab: React.FC<CallTabProps> = ({ 
  roomId, 
  roomCode, 
  partnerId,
  partnerName = 'Partner'
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Video & Voice Calls</h2>
        <p className="text-muted-foreground">
          Connect face-to-face with your partner while watching together
        </p>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardHeader className="pb-2">
            <Video className="w-8 h-8 text-primary mb-2" />
            <CardTitle className="text-lg">HD Video</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Crystal clear video up to 1080p with adaptive quality based on your connection
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-romantic-pink/5 to-romantic-pink/10 border-romantic-pink/20">
          <CardHeader className="pb-2">
            <Phone className="w-8 h-8 text-romantic-pink mb-2" />
            <CardTitle className="text-lg">Voice Only</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Low-bandwidth voice calls perfect for when you just want to talk
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/5 to-green-500/10 border-green-500/20">
          <CardHeader className="pb-2">
            <Wifi className="w-8 h-8 text-green-500 mb-2" />
            <CardTitle className="text-lg">Auto Reconnect</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Automatic reconnection if your connection drops, so you never miss a moment
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* Call Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            How to Start a Call
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium text-primary">1</div>
            <p className="text-muted-foreground">Make sure your partner is in the room with you</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium text-primary">2</div>
            <p className="text-muted-foreground">Click the "Video Call" or "Voice Call" button at the bottom right</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium text-primary">3</div>
            <p className="text-muted-foreground">Allow camera and microphone access when prompted</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium text-primary">4</div>
            <p className="text-muted-foreground">Your partner will receive an incoming call notification</p>
          </div>
        </CardContent>
      </Card>

      {/* The call overlay is rendered globally via portal */}
      <StableVideoCallOverlay
        roomId={roomId}
        partnerId={partnerId}
        partnerName={partnerName}
      />
    </motion.div>
  );
};
