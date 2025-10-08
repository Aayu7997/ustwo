import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AIRecommendations } from '@/components/AIRecommendations';
import { PreferencesSetup } from '@/components/PreferencesSetup';
import { Button } from '@/components/ui/button';
import { Settings, Sparkles } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface AIMoviesTabProps {
  roomId: string;
  roomCode: string;
  partnerId?: string;
}

export const AIMoviesTab: React.FC<AIMoviesTabProps> = ({ roomId, roomCode, partnerId }) => {
  const [activeTab, setActiveTab] = useState<'recommendations' | 'preferences'>('recommendations');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-primary via-purple-500 to-secondary bg-clip-text text-transparent flex items-center justify-center gap-2">
          <Sparkles className="w-8 h-8 text-primary" />
          AI Movie Recommendations
        </h2>
        <p className="text-muted-foreground">
          Powered by Google Gemini - Get personalized suggestions based on your preferences
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="recommendations" className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Get Recommendations
          </TabsTrigger>
          <TabsTrigger value="preferences" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Manage Preferences
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recommendations" className="space-y-4 mt-6">
          <div className="bg-gradient-to-r from-primary/10 via-purple-500/10 to-secondary/10 border border-primary/20 rounded-lg p-4 mb-4">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              How it works
            </h3>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Set up your entertainment preferences (genres, actors, platforms)</li>
              <li>Get AI-powered recommendations in Solo or Couple mode</li>
              <li>Recommendations are based on your combined tastes when in Couple mode</li>
              <li>Save your favorite suggestions to watch later</li>
            </ul>
          </div>

          <AIRecommendations 
            roomId={roomId}
            roomCode={roomCode}
            partnerId={partnerId}
          />
          
          <div className="text-center mt-6">
            <Button
              variant="outline"
              onClick={() => setActiveTab('preferences')}
              className="gap-2"
            >
              <Settings className="w-4 h-4" />
              Update Your Preferences
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="preferences" className="mt-6">
          <PreferencesSetup onClose={() => setActiveTab('recommendations')} />
        </TabsContent>
      </Tabs>

      <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border">
        <p className="text-sm text-center text-muted-foreground">
          💡 <strong>Tip:</strong> The more preferences you set, the better your recommendations will be!
        </p>
      </div>
    </motion.div>
  );
};
