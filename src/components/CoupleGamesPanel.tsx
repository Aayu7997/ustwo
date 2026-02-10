import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Gamepad2, Heart, HelpCircle, Sparkles, Brain,
  Check, X, ArrowRight, Trophy, Users, Flame,
  MessageCircle, Crown, Smile, Zap, ToggleLeft, ToggleRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useCoupleGames, GameType, Question } from '@/hooks/useCoupleGames';
import { cn } from '@/lib/utils';

interface CoupleGamesPanelProps {
  roomId: string;
  partnerId?: string | null;
}

const GAME_OPTIONS: { type: GameType; title: string; icon: React.ReactNode; description: string; gradient: string; emoji: string; nsfw?: boolean }[] = [
  {
    type: 'would_you_rather', title: 'Would You Rather',
    icon: <HelpCircle className="w-5 h-5" />,
    description: 'Choose between two options', gradient: 'from-violet-500 to-fuchsia-500', emoji: '🤔'
  },
  {
    type: 'truth_or_dare', title: 'Truth or Dare',
    icon: <Sparkles className="w-5 h-5" />,
    description: 'Reveal truths or take spicy dares', gradient: 'from-orange-500 to-red-500', emoji: '🔥'
  },
  {
    type: 'love_quiz', title: 'Love Quiz',
    icon: <Heart className="w-5 h-5" />,
    description: 'How well do you know each other?', gradient: 'from-pink-500 to-rose-500', emoji: '💕'
  },
  {
    type: 'compatibility', title: 'Compatibility Wars',
    icon: <Brain className="w-5 h-5" />,
    description: 'Discover your compatibility score', gradient: 'from-blue-500 to-indigo-500', emoji: '⚔️'
  },
  {
    type: 'dirty_confessions', title: 'Dirty Confessions',
    icon: <MessageCircle className="w-5 h-5" />,
    description: 'Confess your deepest secrets', gradient: 'from-rose-600 to-pink-800', emoji: '🤫', nsfw: true
  },
  {
    type: 'power_play', title: 'Power Play',
    icon: <Crown className="w-5 h-5" />,
    description: 'Dominance & teasing challenges', gradient: 'from-amber-500 to-red-600', emoji: '👑', nsfw: true
  },
  {
    type: 'mood_roulette', title: 'Mood Roulette',
    icon: <Zap className="w-5 h-5" />,
    description: 'Random moods, endless fun', gradient: 'from-teal-500 to-emerald-500', emoji: '🎰'
  },
  {
    type: 'emoji_dare', title: 'Emoji Dare Board',
    icon: <Smile className="w-5 h-5" />,
    description: 'Emoji-based silly dares', gradient: 'from-yellow-400 to-orange-500', emoji: '😜'
  },
];

export const CoupleGamesPanel: React.FC<CoupleGamesPanelProps> = ({ roomId, partnerId }) => {
  const {
    currentGame, loading, isMyTurn, bothAnswered,
    nsfwEnabled, setNsfwEnabled, spiceLevel, setSpiceLevel,
    startGame, submitAnswer, nextQuestion, endGame
  } = useCoupleGames({ roomId, partnerId });

  const [textAnswer, setTextAnswer] = useState('');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const handleStartGame = async (gameType: GameType) => {
    await startGame(gameType);
  };

  const handleSubmitAnswer = () => {
    if (selectedOption) {
      submitAnswer(selectedOption);
      setSelectedOption(null);
    } else if (textAnswer.trim()) {
      submitAnswer(textAnswer.trim());
      setTextAnswer('');
    }
  };

  const filteredGames = GAME_OPTIONS.filter(g => nsfwEnabled || !g.nsfw);

  // Game selection screen
  if (!currentGame) {
    return (
      <div className="space-y-6">
        {/* Controls Bar */}
        <Card className="p-4 border-none shadow-md bg-card/80 backdrop-blur">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Flame className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">Spice Level</span>
              <div className="w-32">
                <Slider
                  value={[spiceLevel]}
                  min={1} max={5} step={1}
                  onValueChange={([v]) => setSpiceLevel(v)}
                  className="w-full"
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {['🌱', '🌶️', '🔥', '💥', '🌋'][spiceLevel - 1]}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">18+ NSFW</span>
              <Switch
                checked={nsfwEnabled}
                onCheckedChange={setNsfwEnabled}
              />
            </div>
          </div>
        </Card>

        {/* Game Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {filteredGames.map((game) => (
            <motion.button
              key={game.type}
              whileHover={{ scale: 1.03, y: -4 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleStartGame(game.type)}
              disabled={loading || !partnerId}
              className={cn(
                "relative p-5 rounded-2xl text-left overflow-hidden",
                "bg-gradient-to-br", game.gradient,
                "text-white shadow-lg",
                "disabled:opacity-40 disabled:cursor-not-allowed",
                "transition-shadow duration-300 hover:shadow-2xl"
              )}
            >
              <div className="absolute top-2 right-2 text-2xl opacity-40">
                {game.emoji}
              </div>
              <div className="space-y-2">
                <div className="p-2 bg-white/20 rounded-lg w-fit backdrop-blur-sm">
                  {game.icon}
                </div>
                <h3 className="font-bold text-base">{game.title}</h3>
                <p className="text-xs text-white/80 leading-relaxed">{game.description}</p>
              </div>
              {game.nsfw && (
                <Badge className="absolute bottom-2 right-2 bg-red-900/60 text-white text-[10px]">
                  18+
                </Badge>
              )}
            </motion.button>
          ))}
        </div>

        {!partnerId && (
          <Card className="p-4 text-center bg-muted/50 border-dashed">
            <Users className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Waiting for your partner to join the room...
            </p>
          </Card>
        )}
      </div>
    );
  }

  // Active game
  const gameConfig = GAME_OPTIONS.find(g => g.type === currentGame.gameType);
  const question = currentGame.currentQuestion;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-6"
    >
      <Card className={cn(
        "border-none shadow-2xl overflow-hidden",
        "bg-gradient-to-br", gameConfig?.gradient || "from-primary to-accent"
      )}>
        {/* Game Header */}
        <div className="p-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{gameConfig?.emoji}</span>
            <div>
              <h3 className="font-bold text-lg">{gameConfig?.title}</h3>
              <p className="text-xs text-white/70">Round {currentGame.round}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-white/20 text-white border-0">
              {currentGame.scorePlayer1} — {currentGame.scorePlayer2}
            </Badge>
            <Button variant="ghost" size="icon" onClick={endGame} className="text-white hover:bg-white/20 h-8 w-8">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Question Card */}
      <motion.div
        key={question?.id}
        initial={{ opacity: 0, y: 30, rotateX: -10 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ type: 'spring', damping: 20 }}
      >
        <Card className="p-8 border-none shadow-xl bg-card">
          <div className="text-center space-y-4">
            {question?.type && (
              <Badge
                className={cn(
                  "text-sm px-4 py-1",
                  question.type === 'dare' || question.type === 'challenge' 
                    ? "bg-destructive text-destructive-foreground"
                    : "bg-primary text-primary-foreground"
                )}
              >
                {question.type.toUpperCase()}
              </Badge>
            )}
            {question?.category && (
              <Badge variant="outline" className="text-xs">{question.category}</Badge>
            )}
            <p className="text-xl font-semibold leading-relaxed text-foreground">
              {question?.text}
            </p>
          </div>
        </Card>
      </motion.div>

      {/* Answer Area */}
      <AnimatePresence mode="wait">
        {isMyTurn && !bothAnswered && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="p-6 border-none shadow-lg bg-card space-y-4">
              {question?.options ? (
                <div className="grid grid-cols-2 gap-3">
                  {question.options.map((option, index) => (
                    <motion.div key={index} whileTap={{ scale: 0.95 }}>
                      <Button
                        variant={selectedOption === option ? 'default' : 'outline'}
                        onClick={() => setSelectedOption(option)}
                        className={cn(
                          "h-auto py-4 px-4 text-sm w-full",
                          selectedOption === option && "ring-2 ring-primary ring-offset-2"
                        )}
                      >
                        {option}
                      </Button>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <Input
                  value={textAnswer}
                  onChange={(e) => setTextAnswer(e.target.value)}
                  placeholder="Type your answer..."
                  className="h-12"
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmitAnswer()}
                />
              )}
              <Button 
                onClick={handleSubmitAnswer}
                disabled={!selectedOption && !textAnswer.trim()}
                className="w-full h-12 text-base bg-gradient-to-r from-primary to-accent"
                size="lg"
              >
                <Check className="w-5 h-5 mr-2" />
                Submit Answer
              </Button>
            </Card>
          </motion.div>
        )}

        {!isMyTurn && !bothAnswered && (
          <Card className="p-8 border-none shadow-lg bg-card">
            <div className="text-center space-y-3">
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-14 h-14 mx-auto rounded-full bg-primary/15 flex items-center justify-center"
              >
                <Heart className="w-7 h-7 text-primary" />
              </motion.div>
              <p className="text-muted-foreground font-medium">Waiting for partner's answer...</p>
            </div>
          </Card>
        )}

        {bothAnswered && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 15 }}
          >
            <Card className="p-6 border-none shadow-xl bg-card space-y-5">
              <h4 className="font-bold text-center text-lg">Results! 🎉</h4>
              <div className="grid grid-cols-2 gap-6 text-center">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">You</p>
                  <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                    <span className="font-medium text-sm">
                      {typeof currentGame.player1Answer === 'string' 
                        ? currentGame.player1Answer 
                        : JSON.stringify(currentGame.player1Answer)}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Partner</p>
                  <div className="p-3 rounded-xl bg-accent/30 border border-accent/30">
                    <span className="font-medium text-sm">
                      {typeof currentGame.player2Answer === 'string' 
                        ? currentGame.player2Answer 
                        : JSON.stringify(currentGame.player2Answer)}
                    </span>
                  </div>
                </div>
              </div>

              {currentGame.player1Answer === currentGame.player2Answer && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-center gap-2 text-primary font-bold"
                >
                  <Trophy className="w-6 h-6" />
                  <span>You matched! 💕</span>
                </motion.div>
              )}

              <Button onClick={nextQuestion} className="w-full h-12" size="lg">
                Next Question
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Score Footer */}
      <Card className="p-4 border-none bg-card/80">
        <div className="flex justify-between items-center">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">You</p>
            <p className="text-2xl font-bold text-primary">{currentGame.scorePlayer1}</p>
          </div>
          <Heart className="w-6 h-6 text-primary" />
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Partner</p>
            <p className="text-2xl font-bold text-accent-foreground">{currentGame.scorePlayer2}</p>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};
