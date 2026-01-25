import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  Home,
  ChevronLeft,
  ChevronRight
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

const tabs = [
  { id: 'video' as TabType, label: 'Watch', icon: Video, description: 'Video player & calls' },
  { id: 'notes' as TabType, label: 'Notes', icon: FileText, description: 'Shared notes' },
  { id: 'calendar' as TabType, label: 'Calendar', icon: Calendar, description: 'Plan movie nights' },
  { id: 'watchlist' as TabType, label: 'Watchlist', icon: Bookmark, description: 'Save for later' },
  { id: 'ai-movies' as TabType, label: 'AI Picks', icon: Film, description: 'Smart recommendations' },
  { id: 'love-meter' as TabType, label: 'Love', icon: Heart, description: 'Track your time' },
  { id: 'themes' as TabType, label: 'Themes', icon: Palette, description: 'Customize look' },
  { id: 'settings' as TabType, label: 'Settings', icon: Settings, description: 'Room settings' },
];

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
    <TooltipProvider delayDuration={0}>
      <motion.aside
        initial={{ x: -20, opacity: 0 }}
        animate={{ 
          x: 0, 
          opacity: 1,
          width: isCollapsed ? 72 : 260 
        }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className={cn(
          "fixed left-0 top-0 h-screen z-40",
          "bg-sidebar border-r border-sidebar-border",
          "flex flex-col"
        )}
      >
        {/* Header */}
        <div className={cn(
          "p-4 border-b border-sidebar-border",
          isCollapsed ? "flex flex-col items-center" : ""
        )}>
          {/* Logo & Home */}
          <div className={cn(
            "flex items-center mb-4",
            isCollapsed ? "justify-center" : "gap-3"
          )}>
            <button 
              onClick={() => navigate('/')}
              className="w-10 h-10 rounded-xl bg-gradient-romantic flex items-center justify-center hover:opacity-90 transition-opacity"
            >
              <Heart className="w-5 h-5 text-white" fill="white" />
            </button>
            {!isCollapsed && (
              <div className="flex-1">
                <h1 className="font-bold text-gradient">UsTwo</h1>
                <p className="text-xs text-muted-foreground">Movie Room</p>
              </div>
            )}
          </div>
          
          {/* Room Code */}
          {roomCode && (
            <div className={cn("space-y-2", isCollapsed && "hidden")}>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Room Code</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyRoomCode}
                className="w-full justify-between font-mono"
              >
                <span className="font-bold tracking-widest">{roomCode}</span>
                {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          )}

          {/* Partner Status */}
          <div className={cn(
            "flex items-center gap-2 mt-3",
            isCollapsed && "justify-center"
          )}>
            <span className={cn(
              "w-2.5 h-2.5 rounded-full",
              isPartnerOnline ? "bg-success animate-pulse" : "bg-muted-foreground/50"
            )} />
            {!isCollapsed && (
              <span className="text-xs text-muted-foreground">
                {isPartnerOnline ? 'Partner Online' : 'Waiting for partner'}
              </span>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            const button = (
              <Button
                key={tab.id}
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-3 h-11 font-medium transition-all",
                  isCollapsed && "justify-center px-0",
                  isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
                  !isActive && "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
                onClick={() => onTabChange(tab.id)}
              >
                <Icon className={cn(
                  "w-5 h-5 shrink-0",
                  isActive && "text-primary"
                )} />
                {!isCollapsed && <span>{tab.label}</span>}
                {isActive && !isCollapsed && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute left-0 w-1 h-6 bg-primary rounded-r-full"
                  />
                )}
              </Button>
            );

            if (isCollapsed) {
              return (
                <Tooltip key={tab.id}>
                  <TooltipTrigger asChild>
                    {button}
                  </TooltipTrigger>
                  <TooltipContent side="right" className="flex flex-col">
                    <span className="font-medium">{tab.label}</span>
                    <span className="text-xs text-muted-foreground">{tab.description}</span>
                  </TooltipContent>
                </Tooltip>
              );
            }

            return button;
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-sidebar-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className={cn(
              "w-full justify-center",
              !isCollapsed && "justify-between"
            )}
          >
            {!isCollapsed && <span className="text-xs text-muted-foreground">Collapse</span>}
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </Button>
        </div>
      </motion.aside>
    </TooltipProvider>
  );
};
