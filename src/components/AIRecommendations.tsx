import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Heart, ExternalLink, Star, Calendar, Clock, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface Recommendation {
  title: string;
  platform: string;
  why_recommended: string;
  genre?: string;
  rating?: string;
  poster_url?: string;
}

interface AIRecommendationsProps {
  roomId: string;
  roomCode: string;
  partnerId?: string;
}

export const AIRecommendations: React.FC<AIRecommendationsProps> = ({ 
  roomId, 
  roomCode, 
  partnerId 
}) => {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [userPreferences, setUserPreferences] = useState<any>(null);
  const [partnerPreferences, setPartnerPreferences] = useState<any>(null);
  const [showRecommendations, setShowRecommendations] = useState(false);

  // Fetch user preferences
  useEffect(() => {
    const fetchPreferences = async () => {
      if (!user) return;

      try {
        // Fetch current user preferences (always)
        const { data: userPref, error: userError } = await supabase
          .from('preferences')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (userError) throw userError;
        setUserPreferences(userPref);

        // Fetch partner preferences only when available
        if (partnerId) {
          const { data: partnerPref, error: partnerError } = await supabase
            .from('preferences')
            .select('*')
            .eq('user_id', partnerId)
            .maybeSingle();

          if (partnerError) throw partnerError;
          setPartnerPreferences(partnerPref);
        }

        // Load existing recommendations
        const { data: existingRecs, error: recsError } = await supabase
          .from('ai_recommendations')
          .select('recommendations')
          .eq('room_id', roomId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!recsError && existingRecs) {
          setRecommendations(existingRecs.recommendations as unknown as Recommendation[]);
          setShowRecommendations(true);
        }
      } catch (error) {
        console.error('Error fetching preferences:', error);
      }
    };

    fetchPreferences();
  }, [user, partnerId, roomId]);

  const generateRecommendations = async (mode: 'solo' | 'couple' = 'couple') => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to generate recommendations",
        variant: "destructive"
      });
      return;
    }

    if (mode === 'couple' && !partnerId) {
      toast({
        title: "No Partner Yet",
        description: "Your partner needs to join the room for couple recommendations. Try solo mode instead!",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-recommendations', {
        body: {
          userPreferences: userPreferences || {},
          partnerPreferences: mode === 'couple' ? (partnerPreferences || {}) : null,
          roomId,
          partnerId: mode === 'couple' ? partnerId : null,
          mode
        }
      });

      if (error) throw error;

      // De-duplicate by title to avoid repeats
      const unique = Array.from(new Map(((data.recommendations || []) as Recommendation[]).map((r: Recommendation) => [r.title.toLowerCase(), r])).values());
      setRecommendations(unique as Recommendation[]);
      setShowRecommendations(true);
      
      const modeText = mode === 'couple' ? 'for you and your partner' : 'just for you';
      toast({
        title: "AI Magic! ✨",
        description: `Generated ${unique.length} personalized recommendations ${modeText}!`
      });
    } catch (error: any) {
      console.error('Error generating recommendations:', error);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate AI recommendations",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const saveRecommendation = async (recommendation: Recommendation) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('saved_recommendations')
        .insert({
          room_id: roomId,
          recommendation_data: recommendation as any,
          saved_by: user.id
        });

      if (error) throw error;

      toast({
        title: "Saved! ❤️",
        description: `"${recommendation.title}" saved to your couple's timeline`
      });
    } catch (error: any) {
      console.error('Error saving recommendation:', error);
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save recommendation",
        variant: "destructive"
      });
    }
  };

  const getPlatformColor = (platform: string) => {
    const colors: { [key: string]: string } = {
      'netflix': 'bg-red-500',
      'prime video': 'bg-blue-500',
      'disney+': 'bg-blue-600',
      'hbo max': 'bg-purple-600',
      'youtube': 'bg-red-600',
      'hulu': 'bg-green-500',
      'default': 'bg-primary'
    };
    return colors[platform.toLowerCase()] || colors.default;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="flex items-center justify-center space-x-2">
          <Sparkles className="h-6 w-6 text-primary animate-pulse" />
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            AI Movie Recommendations
          </h2>
          <Sparkles className="h-6 w-6 text-primary animate-pulse" />
        </div>
        <p className="text-muted-foreground">
          Powered by AI to find the perfect content for you and your partner
        </p>
      </div>

      {/* Generate Buttons */}
      {!showRecommendations && (
        <div className="text-center space-y-3">
          <div className="flex justify-center gap-3">
            <Button
              onClick={() => generateRecommendations('solo')}
              disabled={loading}
              variant="outline"
              className="px-6 py-3 rounded-xl font-medium shadow-md hover:shadow-lg transition-all duration-300"
            >
              {loading ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="mr-2"
                  >
                    <Sparkles className="h-4 w-4" />
                  </motion.div>
                  Generating...
                </>
              ) : (
                <>
                  <Film className="mr-2 h-4 w-4" />
                  Solo Mode
                </>
              )}
            </Button>
            
            {partnerId && (
              <Button
                onClick={() => generateRecommendations('couple')}
                disabled={loading}
                className="relative overflow-hidden bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white px-6 py-3 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-300"
              >
                {loading ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="mr-2"
                    >
                      <Sparkles className="h-4 w-4" />
                    </motion.div>
                    Generating Magic...
                  </>
                ) : (
                  <>
                    <Heart className="mr-2 h-4 w-4" />
                    Couple Mode
                  </>
                )}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {partnerId 
              ? "Choose solo for personal picks or couple for shared recommendations" 
              : "Solo mode available - invite your partner for couple recommendations"}
          </p>
        </div>
      )}

      {/* Recommendations Grid */}
      <AnimatePresence>
        {showRecommendations && recommendations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {recommendations.map((rec, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.02, y: -5 }}
                className="group"
              >
                <Card className="relative overflow-hidden border border-border/50 bg-card/50 backdrop-blur-sm hover:shadow-lg transition-all duration-300">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                        {rec.title}
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => saveRecommendation(rec)}
                        className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-500"
                      >
                        <Heart className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Badge 
                        className={`text-white ${getPlatformColor(rec.platform)} hover:${getPlatformColor(rec.platform)}/90`}
                      >
                        {rec.platform}
                      </Badge>
                      {rec.genre && (
                        <Badge variant="secondary" className="text-xs">
                          {rec.genre}
                        </Badge>
                      )}
                      {rec.rating && (
                        <div className="flex items-center space-x-1 text-yellow-500">
                          <Star className="h-3 w-3 fill-current" />
                          <span className="text-xs font-medium">{rec.rating}</span>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                      {rec.why_recommended}
                    </p>
                    
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 group/btn hover:bg-primary hover:text-primary-foreground transition-colors"
                        onClick={() => {
                          // Open platform search or direct link
                          const searchQuery = encodeURIComponent(rec.title);
                          const platformUrls: { [key: string]: string } = {
                            'netflix': `https://www.netflix.com/search?q=${searchQuery}`,
                            'prime video': `https://www.amazon.com/s?k=${searchQuery}&i=instant-video`,
                            'disney+': `https://www.disneyplus.com/search/${searchQuery}`,
                            'youtube': `https://www.youtube.com/results?search_query=${searchQuery}`,
                            'hbo max': `https://www.hbomax.com/search?q=${searchQuery}`
                          };
                          const url = platformUrls[rec.platform.toLowerCase()] || `https://www.google.com/search?q=${searchQuery}+${rec.platform}`;
                          window.open(url, '_blank');
                        }}
                      >
                        <ExternalLink className="h-3 w-3 mr-1 group-hover/btn:scale-110 transition-transform" />
                        Watch Now
                      </Button>
                    </div>
                  </CardContent>
                  
                  {/* Hover Effect Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Regenerate Button */}
      {showRecommendations && (
        <div className="text-center">
          <Button
            variant="outline"
            onClick={() => {
              setShowRecommendations(false);
              generateRecommendations();
            }}
            disabled={loading}
            className="hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Generate New Suggestions
          </Button>
        </div>
      )}

      {/* Empty State */}
      {showRecommendations && recommendations.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <Film className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground mb-2">
            No recommendations yet
          </h3>
          <p className="text-sm text-muted-foreground">
            Set up your preferences to get personalized AI suggestions
          </p>
        </motion.div>
      )}
    </div>
  );
};