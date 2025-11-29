import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Video, 
  FileText, 
  Calendar,
  Bookmark,
  Film, 
  Heart, 
  Palette,
  Settings,
  Copy,
  Check,
  ArrowLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

type TabType = 'video' | 'notes' | 'calendar' | 'watchlist' | 'ai-movies' | 'love-meter' | 'themes' | 'settings';

interface RoomSidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  roomCode?: string;
  isPartnerOnline: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const RoomSidebar: React.FC<RoomSidebarProps> = ({
  activeTab,
  onTabChange,
  roomCode,
  isPartnerOnline,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const navigate = useNavigate();
  const [copied, setCopied] = React.useState(false);

  const tabs = [
    { id: 'video' as TabType, label: 'Watch & Call', icon: Video },
    { id: 'notes' as TabType, label: 'Notes', icon: FileText },
    { id: 'calendar' as TabType, label: 'Calendar', icon: Calendar },
    { id: 'watchlist' as TabType, label: 'Watchlist', icon: Bookmark },
    { id: 'ai-movies' as TabType, label: 'AI Movies', icon: Film },
    { id: 'love-meter' as TabType, label: 'Love Meter', icon: Heart },
    { id: 'themes' as TabType, label: 'Themes', icon: Palette },
    { id: 'settings' as TabType, label: 'Settings', icon: Settings },
  ];

  const handleCopyRoomCode = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Room code copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <motion.aside
      initial={{ x: -280 }}
      animate={{ x: 0, width: isCollapsed ? 80 : 280 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className={cn(
        "fixed left-0 top-0 h-screen bg-card border-r border-border z-40",
        "flex flex-col"
      )}
    >
      {/* Header */}
      <div className="p-6 border-b border-border">
        {!isCollapsed && (
          <>
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Home</span>
              </Button>
            </div>
            
            {roomCode && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Room Code</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyRoomCode}
                  className="w-full justify-between"
                >
                  <span className="font-mono font-bold">{roomCode}</span>
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            )}

            <div className="flex items-center gap-2 mt-4">
              <div className={cn(
                "w-2 h-2 rounded-full",
                isPartnerOnline ? "bg-video-active" : "bg-muted-foreground"
              )} />
              <span className="text-xs text-muted-foreground">
                {isPartnerOnline ? 'Partner Online' : 'Partner Offline'}
              </span>
            </div>
          </>
        )}
        
        {isCollapsed && (
          <div className="flex flex-col items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className={cn(
              "w-3 h-3 rounded-full",
              isPartnerOnline ? "bg-video-active animate-pulse" : "bg-muted-foreground"
            )} />
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        <div className="space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <Button
                key={tab.id}
                variant={isActive ? 'default' : 'ghost'}
                className={cn(
                  "w-full justify-start",
                  isCollapsed && "justify-center px-2",
                  isActive && "bg-primary text-primary-foreground"
                )}
                onClick={() => onTabChange(tab.id)}
              >
                <Icon className={cn("w-4 h-4", !isCollapsed && "mr-3")} />
                {!isCollapsed && <span>{tab.label}</span>}
              </Button>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      {!isCollapsed && (
        <div className="p-4 border-t border-border">
          <div className="text-xs text-muted-foreground text-center">
            UsTwo • Watch Together
          </div>
        </div>
      )}
    </motion.aside>
  );
};
