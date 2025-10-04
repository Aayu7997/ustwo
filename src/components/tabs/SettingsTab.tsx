import React from 'react';
import { motion } from 'framer-motion';
import { ExtensionBridge } from '@/components/ExtensionBridge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Chrome } from 'lucide-react';

interface SettingsTabProps {
  roomId: string;
  roomCode: string;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ roomId, roomCode }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Room Settings</h2>
        <p className="text-muted-foreground">
          Manage room preferences and browser extension
        </p>
      </div>

      {/* Chrome Extension Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Chrome className="w-5 h-5" />
            Chrome Extension
          </CardTitle>
          <CardDescription>
            Sync with Netflix, Prime Video, YouTube and other streaming platforms
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExtensionBridge roomId={roomId} roomCode={roomCode} />
        </CardContent>
      </Card>
    </motion.div>
  );
};
