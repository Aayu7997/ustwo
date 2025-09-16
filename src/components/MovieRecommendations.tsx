import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRecommendations, MovieRecommendation } from '@/hooks/useRecommendations';
import { motion, AnimatePresence } from 'framer-motion';
import { Film, Sparkles, Star, Play } from 'lucide-react';

const GENRES = [
  'Action', 'Comedy', 'Drama', 'Horror', 'Romance', 'Sci-Fi',
  'Thriller', 'Documentary', 'Animation', 'Fantasy', 'Mystery'
];

const PLATFORMS = [
  'Netflix', 'YouTube', 'Amazon Prime', 'Disney+', 'HBO Max',
  'Hulu', 'Apple TV+', 'Paramount+', 'Any'
];

const MOODS = [
  'Romantic', 'Adventurous', 'Cozy', 'Thrilling', 'Funny', 
  'Emotional', 'Light-hearted', 'Intense', 'Surprise Me!'
];

export interface MovieRecommendationsProps {
  roomId?: string;
  partnerId?: string;
}

export const MovieRecommendations: React.FC<MovieRecommendationsProps> = ({ roomId, partnerId }) => {
  const { recommendations, loading, getRecommendations, surpriseMe } = useRecommendations();
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [watchHistory, setWatchHistory] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [mood, setMood] = useState<string>('');

  const canRequest = Boolean(roomId && partnerId);

  const handleGenreChange = (genre: string, checked: boolean) => {
    setSelectedGenres(prev => 
      checked 
        ? [...prev, genre]
        : prev.filter(g => g !== genre)
    );
  };

  const handlePlatformChange = (platform: string, checked: boolean) => {
    setSelectedPlatforms(prev => 
      checked 
        ? [...prev, platform]
        : prev.filter(p => p !== platform)
    );
  };

const handleGetRecommendations = () => {
  if (!canRequest) return;
  getRecommendations(
    {
      genres: selectedGenres,
      watchHistory: watchHistory.split(',').map(s => s.trim()).filter(Boolean),
      preferredPlatforms: selectedPlatforms,
    },
    mood,
    { roomId: roomId!, partnerId: partnerId! }
  );
};

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-2"
      >
        <div className="flex items-center justify-center gap-2">
          <Film className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Movie Recommendations</h2>
        </div>
        <p className="text-muted-foreground">Let AI find the perfect content for you both</p>
      </motion.div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="text-sm font-medium mb-3 block">Favorite Genres</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {GENRES.map(genre => (
                <div key={genre} className="flex items-center space-x-2">
                  <Checkbox
                    id={genre}
                    checked={selectedGenres.includes(genre)}
                    onCheckedChange={(checked) => handleGenreChange(genre, checked as boolean)}
                  />
                  <label htmlFor={genre} className="text-sm">{genre}</label>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-3 block">Preferred Platforms</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {PLATFORMS.map(platform => (
                <div key={platform} className="flex items-center space-x-2">
                  <Checkbox
                    id={platform}
                    checked={selectedPlatforms.includes(platform)}
                    onCheckedChange={(checked) => handlePlatformChange(platform, checked as boolean)}
                  />
                  <label htmlFor={platform} className="text-sm">{platform}</label>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-3 block">Current Mood</label>
            <Select value={mood} onValueChange={setMood}>
              <SelectTrigger>
                <SelectValue placeholder="What's the vibe?" />
              </SelectTrigger>
              <SelectContent>
                {MOODS.map(moodOption => (
                  <SelectItem key={moodOption} value={moodOption}>
                    {moodOption}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

<div className="space-y-3">
  {!canRequest && (
    <div className="text-center p-4 bg-muted/50 rounded-lg">
      <p className="text-sm text-muted-foreground">
        💕 You need to be in a room with your partner to get AI recommendations
      </p>
    </div>
  )}
  
  <div className="flex gap-3">
    <Button 
      onClick={handleGetRecommendations}
      disabled={loading || !canRequest}
      className="flex-1 bg-gradient-to-r from-love-pink to-love-purple hover:from-love-pink/90 hover:to-love-purple/90 text-white shadow-lg transition-all duration-300"
    >
      {loading ? (
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          Finding Magic...
        </div>
      ) : (
        'Get AI Recommendations'
      )}
    </Button>
    <Button 
      onClick={() => canRequest && surpriseMe({ roomId: roomId!, partnerId: partnerId! })}
      disabled={loading || !canRequest}
      variant="outline"
      className="flex items-center gap-2 border-love-pink text-love-pink hover:bg-love-pink hover:text-white transition-all duration-300"
    >
      <Sparkles className="h-4 w-4" />
      Surprise Me!
    </Button>
  </div>
</div>
        </CardContent>
      </Card>

      <AnimatePresence>
        {recommendations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Perfect for You Both
            </h3>
            <div className="grid gap-4">
              {recommendations.map((rec, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-semibold text-lg">{rec.title}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary">{rec.platform}</Badge>
                            <Badge variant="outline">{rec.genre}</Badge>
                            <span className="text-sm text-muted-foreground">★ {rec.rating}</span>
                          </div>
                        </div>
                        <Button size="sm" className="flex items-center gap-2">
                          <Play className="h-3 w-3" />
                          Watch
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{rec.description}</p>
                      <div className="bg-muted/50 p-3 rounded-lg">
                        <p className="text-sm">
                          <span className="font-medium">Perfect because:</span> {rec.reason}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};