import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, Plus, X, Save, Heart, Star, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface Preferences {
  genres: string[];
  actors: string[];
  directors: string[];
  platforms: string[];
  disliked: string[];
}

interface PreferencesSetupProps {
  onClose?: () => void;
}

const POPULAR_GENRES = [
  'Action', 'Comedy', 'Drama', 'Horror', 'Romance', 'Sci-Fi', 'Thriller', 
  'Animation', 'Documentary', 'Fantasy', 'Mystery', 'Crime', 'Adventure'
];

const POPULAR_PLATFORMS = [
  'Netflix', 'Prime Video', 'Disney+', 'HBO Max', 'YouTube', 'Hulu', 
  'Apple TV+', 'Paramount+', 'Peacock', 'Free Streaming'
];

export const PreferencesSetup: React.FC<PreferencesSetupProps> = ({ onClose }) => {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<Preferences>({
    genres: [],
    actors: [],
    directors: [],
    platforms: [],
    disliked: []
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newInput, setNewInput] = useState({
    actor: '',
    director: '',
    disliked: ''
  });

  // Load existing preferences
  useEffect(() => {
    const loadPreferences = async () => {
      if (!user) return;

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('preferences')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setPreferences({
            genres: data.genres || [],
            actors: data.actors || [],
            directors: data.directors || [],
            platforms: data.platforms || [],
            disliked: data.disliked || []
          });
        }
      } catch (error) {
        console.error('Error loading preferences:', error);
        toast({
          title: "Load Failed",
          description: "Failed to load your preferences",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, [user]);

  const addItem = (category: keyof Preferences, item: string) => {
    if (!item.trim()) return;
    
    setPreferences(prev => ({
      ...prev,
      [category]: [...prev[category], item.trim()]
    }));
    
    // Clear input
    if (category === 'actors') setNewInput(prev => ({ ...prev, actor: '' }));
    if (category === 'directors') setNewInput(prev => ({ ...prev, director: '' }));
    if (category === 'disliked') setNewInput(prev => ({ ...prev, disliked: '' }));
  };

  const removeItem = (category: keyof Preferences, index: number) => {
    setPreferences(prev => ({
      ...prev,
      [category]: prev[category].filter((_, i) => i !== index)
    }));
  };

  const toggleGenre = (genre: string) => {
    setPreferences(prev => ({
      ...prev,
      genres: prev.genres.includes(genre)
        ? prev.genres.filter(g => g !== genre)
        : [...prev.genres, genre]
    }));
  };

  const togglePlatform = (platform: string) => {
    setPreferences(prev => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter(p => p !== platform)
        : [...prev.platforms, platform]
    }));
  };

  const savePreferences = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('preferences')
        .upsert({
          user_id: user.id,
          genres: preferences.genres,
          actors: preferences.actors,
          directors: preferences.directors,
          platforms: preferences.platforms,
          disliked: preferences.disliked,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) throw error;

      toast({
        title: "Preferences Saved! ✨",
        description: "Your entertainment preferences have been updated"
      });

      if (onClose) onClose();
    } catch (error: any) {
      console.error('Error saving preferences:', error);
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save preferences",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="flex items-center justify-center h-64">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <Settings className="h-8 w-8 text-primary" />
          </motion.div>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-4xl mx-auto space-y-6"
    >
      <Card className="border border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <Star className="h-6 w-6 text-yellow-500" />
            <CardTitle className="text-2xl bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Entertainment Preferences
            </CardTitle>
            <Star className="h-6 w-6 text-yellow-500" />
          </div>
          <p className="text-muted-foreground">
            Help AI find the perfect content for you and your partner
          </p>
        </CardHeader>

        <CardContent className="space-y-8">
          {/* Favorite Genres */}
          <div className="space-y-4">
            <Label className="text-lg font-semibold flex items-center">
              <Film className="mr-2 h-5 w-5" />
              Favorite Genres
            </Label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {POPULAR_GENRES.map((genre) => (
                <motion.div key={genre} whileTap={{ scale: 0.95 }}>
                  <Badge
                    variant={preferences.genres.includes(genre) ? "default" : "outline"}
                    className={`cursor-pointer transition-all duration-200 hover:scale-105 ${
                      preferences.genres.includes(genre)
                        ? 'bg-primary text-primary-foreground shadow-md'
                        : 'hover:bg-primary/10'
                    }`}
                    onClick={() => toggleGenre(genre)}
                  >
                    {genre}
                  </Badge>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Favorite Actors */}
          <div className="space-y-4">
            <Label className="text-lg font-semibold flex items-center">
              <Heart className="mr-2 h-5 w-5" />
              Favorite Actors
            </Label>
            <div className="flex space-x-2">
              <Input
                placeholder="e.g., Ryan Gosling, Emma Stone"
                value={newInput.actor}
                onChange={(e) => setNewInput(prev => ({ ...prev, actor: e.target.value }))}
                onKeyPress={(e) => e.key === 'Enter' && addItem('actors', newInput.actor)}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => addItem('actors', newInput.actor)}
                disabled={!newInput.actor.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {preferences.actors.map((actor, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <Badge variant="secondary" className="flex items-center gap-1">
                    {actor}
                    <X
                      className="h-3 w-3 cursor-pointer hover:text-red-500"
                      onClick={() => removeItem('actors', index)}
                    />
                  </Badge>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Favorite Directors */}
          <div className="space-y-4">
            <Label className="text-lg font-semibold">Favorite Directors</Label>
            <div className="flex space-x-2">
              <Input
                placeholder="e.g., Christopher Nolan, Greta Gerwig"
                value={newInput.director}
                onChange={(e) => setNewInput(prev => ({ ...prev, director: e.target.value }))}
                onKeyPress={(e) => e.key === 'Enter' && addItem('directors', newInput.director)}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => addItem('directors', newInput.director)}
                disabled={!newInput.director.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {preferences.directors.map((director, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <Badge variant="secondary" className="flex items-center gap-1">
                    {director}
                    <X
                      className="h-3 w-3 cursor-pointer hover:text-red-500"
                      onClick={() => removeItem('directors', index)}
                    />
                  </Badge>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Preferred Platforms */}
          <div className="space-y-4">
            <Label className="text-lg font-semibold">Preferred Streaming Platforms</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {POPULAR_PLATFORMS.map((platform) => (
                <motion.div key={platform} whileTap={{ scale: 0.95 }}>
                  <Badge
                    variant={preferences.platforms.includes(platform) ? "default" : "outline"}
                    className={`cursor-pointer transition-all duration-200 hover:scale-105 ${
                      preferences.platforms.includes(platform)
                        ? 'bg-primary text-primary-foreground shadow-md'
                        : 'hover:bg-primary/10'
                    }`}
                    onClick={() => togglePlatform(platform)}
                  >
                    {platform}
                  </Badge>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Dislikes */}
          <div className="space-y-4">
            <Label className="text-lg font-semibold">Things You Dislike</Label>
            <div className="flex space-x-2">
              <Input
                placeholder="e.g., Horror movies, Violent content"
                value={newInput.disliked}
                onChange={(e) => setNewInput(prev => ({ ...prev, disliked: e.target.value }))}
                onKeyPress={(e) => e.key === 'Enter' && addItem('disliked', newInput.disliked)}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => addItem('disliked', newInput.disliked)}
                disabled={!newInput.disliked.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {preferences.disliked.map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <Badge variant="destructive" className="flex items-center gap-1">
                    {item}
                    <X
                      className="h-3 w-3 cursor-pointer hover:text-red-300"
                      onClick={() => removeItem('disliked', index)}
                    />
                  </Badge>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-center pt-6">
            <Button
              onClick={savePreferences}
              disabled={saving}
              className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white px-8 py-3 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-300"
            >
              {saving ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="mr-2"
                  >
                    <Settings className="h-4 w-4" />
                  </motion.div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Preferences
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};