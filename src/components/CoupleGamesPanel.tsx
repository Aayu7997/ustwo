import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Gamepad2, 
  Heart, 
  HelpCircle, 
  Sparkles, 
  Brain,
  Check,
  X,
  ArrowRight,
  Trophy,
  Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useCoupleGames, GameType, Question } from '@/hooks/useCoupleGames';
import { cn } from '@/lib/utils';

interface CoupleGamesPanelProps {
  roomId: string;
  partnerId?: string | null;
}

const GAME_OPTIONS: { type: GameType; title: string; icon: React.ReactNode; description: string; color: string }[] = [
  {
    type: 'would_you_rather',
    title: 'Would You Rather',
    icon: <HelpCircle className="w-5 h-5" />,
    description: 'Choose between two options',
    color: 'from-purple-500 to-pink-500'
  },
  {
    type: 'truth_or_dare',
    title: 'Truth or Dare',
    icon: <Sparkles className="w-5 h-5" />,
    description: 'Reveal truths or take dares',
    color: 'from-orange-500 to-red-500'
  },
  {
    type: 'love_quiz',
    title: 'Love Quiz',
    icon: <Heart className="w-5 h-5" />,
    description: 'How well do you know each other?',
    color: 'from-pink-500 to-rose-500'
  },
  {
    type: 'compatibility',
    title: 'Compatibility Test',
    icon: <Brain className="w-5 h-5" />,
    description: 'Discover your compatibility',
    color: 'from-blue-500 to-indigo-500'
  }
];

export const CoupleGamesPanel: React.FC<CoupleGamesPanelProps> = ({
  roomId,
  partnerId
}) => {
  const {
    currentGame,
    loading,
    isMyTurn,
    bothAnswered,
    startGame,
    submitAnswer,
    nextQuestion,
    endGame
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

  // Game selection screen
  if (!currentGame) {
    return (
      <Card className="border-none shadow-lg bg-gradient-to-br from-card to-card/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-primary" />
            Couple Games
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-6">
            Play fun games together and strengthen your bond! 💕
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {GAME_OPTIONS.map((game) => (
              <motion.button
                key={game.type}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleStartGame(game.type)}
                disabled={loading || !partnerId}
                className={cn(
                  "relative p-4 rounded-xl text-left overflow-hidden",
                  "bg-gradient-to-br",
                  game.color,
                  "text-white shadow-lg",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "transition-all duration-300"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    {game.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold">{game.title}</h3>
                    <p className="text-sm text-white/80">{game.description}</p>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>

          {!partnerId && (
            <div className="mt-4 p-3 bg-muted/50 rounded-lg text-center">
              <Users className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Waiting for your partner to join the room...
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Active game screen
  const gameConfig = GAME_OPTIONS.find(g => g.type === currentGame.gameType);
  const question = currentGame.currentQuestion;

  return (
    <Card className="border-none shadow-lg bg-gradient-to-br from-card to-card/80">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {gameConfig?.icon}
            {gameConfig?.title}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">Round {currentGame.round}</Badge>
            <Button variant="ghost" size="sm" onClick={endGame}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Question */}
        <motion.div
          key={question?.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20"
        >
          <p className="text-lg font-medium text-center">
            {question?.text}
          </p>
          
          {question?.type && (
            <Badge 
              className="mt-3 mx-auto block w-fit"
              variant={question.type === 'truth' ? 'default' : 'destructive'}
            >
              {question.type.toUpperCase()}
            </Badge>
          )}
        </motion.div>

        {/* Answer options */}
        <AnimatePresence mode="wait">
          {isMyTurn && !bothAnswered && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {question?.options ? (
                <div className="grid grid-cols-2 gap-3">
                  {question.options.map((option, index) => (
                    <Button
                      key={index}
                      variant={selectedOption === option ? 'default' : 'outline'}
                      onClick={() => setSelectedOption(option)}
                      className="h-auto py-3 px-4"
                    >
                      {option}
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={textAnswer}
                    onChange={(e) => setTextAnswer(e.target.value)}
                    placeholder="Type your answer..."
                    className="flex-1"
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmitAnswer()}
                  />
                </div>
              )}

              <Button 
                onClick={handleSubmitAnswer}
                disabled={!selectedOption && !textAnswer.trim()}
                className="w-full"
              >
                <Check className="w-4 h-4 mr-2" />
                Submit Answer
              </Button>
            </motion.div>
          )}

          {!isMyTurn && !bothAnswered && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-6"
            >
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/20 flex items-center justify-center"
              >
                <Heart className="w-6 h-6 text-primary" />
              </motion.div>
              <p className="text-muted-foreground">Waiting for partner's answer...</p>
            </motion.div>
          )}

          {bothAnswered && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              <div className="p-4 rounded-xl bg-muted/50">
                <h4 className="font-medium mb-3 text-center">Results! 🎉</h4>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">You</p>
                    <Badge variant="outline" className="text-base">
                      {typeof currentGame.player1Answer === 'string' 
                        ? currentGame.player1Answer 
                        : JSON.stringify(currentGame.player1Answer)}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Partner</p>
                    <Badge variant="outline" className="text-base">
                      {typeof currentGame.player2Answer === 'string' 
                        ? currentGame.player2Answer 
                        : JSON.stringify(currentGame.player2Answer)}
                    </Badge>
                  </div>
                </div>

                {currentGame.player1Answer === currentGame.player2Answer && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 flex items-center justify-center gap-2 text-primary"
                  >
                    <Trophy className="w-5 h-5" />
                    <span className="font-medium">You matched! 💕</span>
                  </motion.div>
                )}
              </div>

              <Button onClick={nextQuestion} className="w-full">
                Next Question
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Score */}
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">You</p>
            <p className="text-xl font-bold">{currentGame.scorePlayer1}</p>
          </div>
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-primary" />
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Partner</p>
            <p className="text-xl font-bold">{currentGame.scorePlayer2}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
