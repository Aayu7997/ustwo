import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useRoom, Room as RoomType } from '@/hooks/useRoom';
import { useAuth } from '@/hooks/useAuth';
import { RoomSidebar } from '@/components/RoomSidebar';
import { VideoTab } from '@/components/tabs/VideoTab';
import { CallTab } from '@/components/tabs/CallTab';
import { NotesTab } from '@/components/tabs/NotesTab';
import { CalendarTab } from '@/components/tabs/CalendarTab';
import { AIMoviesTab } from '@/components/tabs/AIMoviesTab';
import { LoveMeterTab } from '@/components/tabs/LoveMeterTab';
import { ThemesTab } from '@/components/tabs/ThemesTab';
import { FloatingHearts } from '@/components/FloatingHearts';
import { ChatWidget } from '@/components/ChatWidget';
import { WatchPartyEffects } from '@/components/WatchPartyEffects';
import { ExtensionBridge } from '@/components/ExtensionBridge';
import { PartnerPresence } from '@/components/PartnerPresence';
import { Button } from '@/components/ui/button';
import { Heart, ArrowLeft } from 'lucide-react';
import { useRoomPresence } from '@/hooks/useRoomPresence';

type TabType = 'video' | 'call' | 'notes' | 'calendar' | 'ai-movies' | 'love-meter' | 'themes' | 'settings';

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
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading room...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to auth
  }

  if (!currentRoom) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Heart className="w-12 h-12 text-muted-foreground mx-auto" />
          <h2 className="text-2xl font-bold">Room not found</h2>
          <p className="text-muted-foreground">
            The room you're looking for doesn't exist or you don't have access to it.
          </p>
          <Button onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  const renderTabContent = () => {
    if (!roomId || !currentRoom) return null;

    switch (activeTab) {
      case 'video':
        return (
          <VideoTab
            roomId={roomId}
            roomCode={currentRoom.room_code}
            onPlaybackStateChange={(state) => {
              setPlaybackState({
                isPlaying: state.is_playing || false,
                currentTime: state.current_time_seconds || 0
              });
            }}
          />
        );
      case 'call':
        return <CallTab roomId={roomId} roomCode={currentRoom.room_code} />;
      case 'notes':
        return <NotesTab />;
      case 'calendar':
        return <CalendarTab partnerId={currentRoom.partner_id} />;
      case 'ai-movies':
        return (
          <AIMoviesTab
            roomId={roomId}
            roomCode={currentRoom.room_code || ''}
            partnerId={currentRoom.partner_id}
          />
        );
      case 'love-meter':
        return <LoveMeterTab partnerId={currentRoom.partner_id} />;
      case 'themes':
        return <ThemesTab />;
      case 'settings':
        return (
          <div className="text-center space-y-4 p-8">
            <h2 className="text-2xl font-bold">Room Settings</h2>
            <p className="text-muted-foreground">Coming soon...</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar Navigation */}
      <RoomSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        roomCode={currentRoom?.room_code}
        isPartnerOnline={partnerJoined}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content */}
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ 
          opacity: 1,
          marginLeft: sidebarCollapsed ? 80 : 280
        }}
        transition={{ duration: 0.3 }}
        className="flex-1 min-h-screen overflow-y-auto"
      >
        <div className="container mx-auto px-6 py-8 max-w-7xl">
          {/* Partner Presence Indicator */}
          {roomId && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <PartnerPresence roomId={roomId} />
            </motion.div>
          )}

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            <div key={activeTab}>
              {renderTabContent()}
            </div>
          </AnimatePresence>

          {/* Extension Bridge */}
          {roomId && currentRoom && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-8"
            >
              <ExtensionBridge 
                roomId={roomId} 
                roomCode={currentRoom.room_code || ''} 
              />
            </motion.div>
          )}
        </div>
      </motion.main>
      
      {/* Chat Widget */}
      {roomId && (
        <ChatWidget 
          roomId={roomId}
          isMinimized={chatMinimized}
          onToggleMinimize={() => setChatMinimized(!chatMinimized)}
        />
      )}
      
      {/* Watch Party Effects */}
      {roomId && (
        <WatchPartyEffects
          isPlaying={playbackState.isPlaying}
          currentTime={playbackState.currentTime}
          partnerJoined={!!currentRoom?.partner_id}
          onSyncEvent={(event) => console.log('Sync event:', event)}
        />
      )}
      
      {/* Floating Hearts */}
      <FloatingHearts trigger={heartTrigger} />
    </div>
  );
};

export default Room;