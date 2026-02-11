import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useRoom, Room as RoomType } from '@/hooks/useRoom';
import { useAuth } from '@/hooks/useAuth';
import { useVisibilityHandler } from '@/hooks/useVisibilityHandler';
import { useRoomStateManager } from '@/hooks/useRoomStateManager';
import { RoomSidebar } from '@/components/RoomSidebar';
import { VideoTab } from '@/components/tabs/VideoTab';
import { NotesTab } from '@/components/tabs/NotesTab';
import { CalendarTab } from '@/components/tabs/CalendarTab';
import { WatchlistTab } from '@/components/tabs/WatchlistTab';
import { AIMoviesTab } from '@/components/tabs/AIMoviesTab';
import { LoveMeterTab } from '@/components/tabs/LoveMeterTab';
import { ThemesTab } from '@/components/tabs/ThemesTab';
import { SettingsTab } from '@/components/tabs/SettingsTab';
import { GamesTab } from '@/components/tabs/GamesTab';
import { FloatingHearts } from '@/components/FloatingHearts';
import { ChatWidget } from '@/components/ChatWidget';
import { WatchPartyEffects } from '@/components/WatchPartyEffects';
import { PartnerPresence } from '@/components/PartnerPresence';
import { ProductionCallOverlay } from '@/components/ProductionCallOverlay';
import { Button } from '@/components/ui/button';
import { Heart, ArrowLeft, Loader2 } from 'lucide-react';
import { useRoomPresence } from '@/hooks/useRoomPresence';

type TabType = 'video' | 'games' | 'notes' | 'calendar' | 'watchlist' | 'ai-movies' | 'love-meter' | 'themes' | 'settings';

const Room: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { room, fetchRoom, loading } = useRoom();
  const [currentRoom, setCurrentRoom] = useState<RoomType | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('video');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [heartTrigger, setHeartTrigger] = useState(false);
  const [playbackState, setPlaybackState] = useState({ isPlaying: false, currentTime: 0 });
  const [chatMinimized, setChatMinimized] = useState(true);
  const { partnerJoined } = useRoomPresence(roomId || '');
  
  const { saveState, updatePlayback } = useRoomStateManager(roomId || '');
  useVisibilityHandler(roomId || '');

  useEffect(() => {
    if (roomId && !authLoading && user) {
      fetchRoom(roomId);
    } else if (roomId && !authLoading && !user) {
      navigate('/auth');
    }
  }, [roomId, user, authLoading, fetchRoom, navigate]);

  useEffect(() => {
    setCurrentRoom(room);
  }, [room]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-4"
        >
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading your room...</p>
        </motion.div>
      </div>
    );
  }

  if (!user) return null;

  if (!currentRoom) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6 max-w-md"
        >
          <div className="w-20 h-20 mx-auto rounded-2xl bg-muted flex items-center justify-center">
            <Heart className="w-10 h-10 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Room Not Found</h2>
            <p className="text-muted-foreground">
              This room doesn't exist or you don't have access to it.
            </p>
          </div>
          <Button onClick={() => navigate('/')} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Go Home
          </Button>
        </motion.div>
      </div>
    );
  }

  const isRoomCreator = currentRoom?.creator_id === user?.id;
  const partnerId = isRoomCreator ? currentRoom?.partner_id : currentRoom?.creator_id;

  const renderTabContent = () => {
    if (!roomId || !currentRoom) return null;

    const tabComponents: Record<TabType, React.ReactNode> = {
      video: (
        <VideoTab
          roomId={roomId}
          roomCode={currentRoom.room_code}
          isRoomCreator={isRoomCreator}
          partnerId={partnerId}
          partnerName="Partner"
          onPlaybackStateChange={(state) => {
            const newState = {
              isPlaying: state.is_playing || false,
              currentTime: state.current_time_seconds || 0
            };
            setPlaybackState(newState);
            updatePlayback(newState.currentTime, newState.isPlaying);
          }}
        />
      ),
      games: <GamesTab roomId={roomId} partnerId={partnerId} />,
      notes: <NotesTab />,
      calendar: <CalendarTab roomId={roomId} partnerId={partnerId} />,
      watchlist: <WatchlistTab roomId={roomId} />,
      'ai-movies': (
        <AIMoviesTab
          roomId={roomId}
          roomCode={currentRoom.room_code || ''}
          partnerId={currentRoom.partner_id}
        />
      ),
      'love-meter': <LoveMeterTab partnerId={currentRoom.partner_id} />,
      themes: <ThemesTab />,
      settings: <SettingsTab roomId={roomId} roomCode={currentRoom.room_code || ''} />,
    };

    return tabComponents[activeTab];
  };

  return (
    <div className="min-h-screen bg-background">
      <RoomSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        roomCode={currentRoom?.room_code}
        isPartnerOnline={partnerJoined}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <motion.main
        initial={{ opacity: 0 }}
        animate={{ 
          opacity: 1,
          marginLeft: sidebarCollapsed ? 72 : 260
        }}
        transition={{ duration: 0.3 }}
        className="min-h-screen"
      >
        <div className="p-6 lg:p-8 max-w-7xl">
          {roomId && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <PartnerPresence roomId={roomId} />
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderTabContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.main>
      
      {roomId && (
        <ChatWidget 
          roomId={roomId}
          isMinimized={chatMinimized}
          onToggleMinimize={() => setChatMinimized(!chatMinimized)}
        />
      )}
      
      {roomId && (
        <WatchPartyEffects
          isPlaying={playbackState.isPlaying}
          currentTime={playbackState.currentTime}
          partnerJoined={!!currentRoom?.partner_id}
          onSyncEvent={(event) => console.log('Sync event:', event)}
        />
      )}
      
      {/* Video/Voice Call Overlay - ALWAYS visible */}
      {roomId && (
        <ProductionCallOverlay
          roomId={roomId}
          partnerId={partnerId}
          partnerName="Partner"
        />
      )}
      
      <FloatingHearts trigger={heartTrigger} />
    </div>
  );
};

export default Room;
