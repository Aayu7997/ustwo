import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

export type GameType = 'would_you_rather' | 'truth_or_dare' | 'love_quiz' | 'compatibility' | 'memory';

export interface Question {
  id: string;
  text: string;
  options?: string[];
  type?: 'truth' | 'dare';
  category?: string;
}

export interface GameState {
  id: string;
  roomId: string;
  gameType: GameType;
  currentQuestion: Question | null;
  player1Id: string;
  player2Id: string | null;
  player1Answer: any;
  player2Answer: any;
  scorePlayer1: number;
  scorePlayer2: number;
  status: 'waiting' | 'playing' | 'answered' | 'completed';
  round: number;
}

interface UseCoupleGamesProps {
  roomId: string;
  partnerId?: string | null;
}

// Question banks
const WOULD_YOU_RATHER: Question[] = [
  { id: 'wyr1', text: 'Would you rather have a movie night or a game night?', options: ['Movie night', 'Game night'] },
  { id: 'wyr2', text: 'Would you rather travel to the past or the future?', options: ['Past', 'Future'] },
  { id: 'wyr3', text: 'Would you rather have breakfast in bed or a surprise dinner?', options: ['Breakfast in bed', 'Surprise dinner'] },
  { id: 'wyr4', text: 'Would you rather dance in the rain or watch the stars?', options: ['Dance in rain', 'Watch stars'] },
  { id: 'wyr5', text: 'Would you rather have a cozy night in or an adventurous night out?', options: ['Cozy night in', 'Adventurous night out'] },
  { id: 'wyr6', text: 'Would you rather receive flowers or chocolates?', options: ['Flowers', 'Chocolates'] },
  { id: 'wyr7', text: 'Would you rather have a beach vacation or mountain getaway?', options: ['Beach', 'Mountain'] },
  { id: 'wyr8', text: 'Would you rather cook together or order takeout?', options: ['Cook together', 'Order takeout'] },
  { id: 'wyr9', text: 'Would you rather watch sunrise or sunset together?', options: ['Sunrise', 'Sunset'] },
  { id: 'wyr10', text: 'Would you rather have a long hug or a sweet kiss?', options: ['Long hug', 'Sweet kiss'] },
];

const TRUTH_OR_DARE: Question[] = [
  { id: 'tod1', text: 'What was your first impression of me?', type: 'truth' },
  { id: 'tod2', text: 'What do you love most about our relationship?', type: 'truth' },
  { id: 'tod3', text: 'Send your partner a voice message saying "I love you"', type: 'dare' },
  { id: 'tod4', text: 'What is your favorite memory of us together?', type: 'truth' },
  { id: 'tod5', text: 'Do your best impression of your partner', type: 'dare' },
  { id: 'tod6', text: 'What song reminds you of me?', type: 'truth' },
  { id: 'tod7', text: 'Write a short love poem for your partner', type: 'dare' },
  { id: 'tod8', text: 'What is something you want us to do together?', type: 'truth' },
  { id: 'tod9', text: 'Give your partner 3 genuine compliments', type: 'dare' },
  { id: 'tod10', text: 'What makes our relationship special?', type: 'truth' },
];

const LOVE_QUIZ: Question[] = [
  { id: 'lq1', text: "What is your partner's favorite color?", category: 'preferences' },
  { id: 'lq2', text: "What is your partner's dream vacation destination?", category: 'dreams' },
  { id: 'lq3', text: "What is your partner's favorite food?", category: 'preferences' },
  { id: 'lq4', text: "What is your partner's biggest fear?", category: 'deep' },
  { id: 'lq5', text: "What would your partner's ideal date night be?", category: 'preferences' },
  { id: 'lq6', text: "What is your partner's love language?", category: 'deep' },
  { id: 'lq7', text: "What makes your partner laugh the most?", category: 'personality' },
  { id: 'lq8', text: "What is your partner's comfort movie/show?", category: 'preferences' },
  { id: 'lq9', text: "What is one thing on your partner's bucket list?", category: 'dreams' },
  { id: 'lq10', text: "How does your partner like to relax?", category: 'preferences' },
];

const COMPATIBILITY: Question[] = [
  { id: 'comp1', text: 'How important is quality time to you? (1-10)', options: ['1-3', '4-6', '7-10'] },
  { id: 'comp2', text: 'How do you prefer to show affection?', options: ['Words', 'Touch', 'Gifts', 'Acts of service'] },
  { id: 'comp3', text: 'What is your ideal weekend activity?', options: ['Adventure', 'Relaxation', 'Social', 'Creative'] },
  { id: 'comp4', text: 'How do you handle disagreements?', options: ['Talk it out', 'Take space', 'Compromise quickly'] },
  { id: 'comp5', text: 'What role does family play in your life?', options: ['Very important', 'Somewhat important', 'Independent'] },
];

const getQuestionBank = (gameType: GameType): Question[] => {
  switch (gameType) {
    case 'would_you_rather': return WOULD_YOU_RATHER;
    case 'truth_or_dare': return TRUTH_OR_DARE;
    case 'love_quiz': return LOVE_QUIZ;
    case 'compatibility': return COMPATIBILITY;
    default: return WOULD_YOU_RATHER;
  }
};

export const useCoupleGames = ({ roomId, partnerId }: UseCoupleGamesProps) => {
  const { user } = useAuth();
  const [currentGame, setCurrentGame] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(false);

  // Start a new game
  const startGame = useCallback(async (gameType: GameType) => {
    if (!user?.id || !roomId) return null;

    setLoading(true);

    try {
      const questionBank = getQuestionBank(gameType);
      const firstQuestion = questionBank[Math.floor(Math.random() * questionBank.length)];

      // Convert Question to JSON-compatible format
      const questionJson = JSON.parse(JSON.stringify(firstQuestion));

      const { data: game, error } = await supabase
        .from('games')
        .insert({
          room_id: roomId,
          game_type: gameType,
          player1_id: user.id,
          player2_id: partnerId,
          current_question: questionJson,
          status: 'waiting',
          round: 1
        })
        .select()
        .single();

      if (error) throw error;

      const gameState: GameState = {
        id: game.id,
        roomId: game.room_id,
        gameType: game.game_type as GameType,
        currentQuestion: game.current_question as unknown as Question,
        player1Id: game.player1_id,
        player2Id: game.player2_id,
        player1Answer: game.player1_answer,
        player2Answer: game.player2_answer,
        scorePlayer1: game.score_player1 || 0,
        scorePlayer2: game.score_player2 || 0,
        status: game.status as any,
        round: game.round || 1
      };

      setCurrentGame(gameState);

      toast({
        title: 'Game started! 🎮',
        description: `Playing ${gameType.replace(/_/g, ' ')}`
      });

      return gameState;
    } catch (error) {
      console.error('[Games] Failed to start game:', error);
      toast({
        title: 'Failed to start game',
        variant: 'destructive'
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [user?.id, roomId, partnerId]);

  // Submit answer
  const submitAnswer = useCallback(async (answer: any) => {
    if (!currentGame || !user?.id) return;

    const isPlayer1 = currentGame.player1Id === user.id;
    const answerField = isPlayer1 ? 'player1_answer' : 'player2_answer';

    try {
      const { error } = await supabase
        .from('games')
        .update({ 
          [answerField]: answer,
          status: 'playing'
        })
        .eq('id', currentGame.id);

      if (error) throw error;

      // Update local state
      setCurrentGame(prev => prev ? {
        ...prev,
        [isPlayer1 ? 'player1Answer' : 'player2Answer']: answer,
        status: 'playing'
      } : null);

      toast({
        title: 'Answer submitted! ✓',
        description: 'Waiting for partner...'
      });
    } catch (error) {
      console.error('[Games] Failed to submit answer:', error);
      toast({
        title: 'Failed to submit answer',
        variant: 'destructive'
      });
    }
  }, [currentGame, user?.id]);

  // Next question
  const nextQuestion = useCallback(async () => {
    if (!currentGame || !user?.id) return;

    const questionBank = getQuestionBank(currentGame.gameType);
    const usedIds = [currentGame.currentQuestion?.id];
    const availableQuestions = questionBank.filter(q => !usedIds.includes(q.id));
    
    if (availableQuestions.length === 0) {
      // Game complete
      await endGame();
      return;
    }

    const nextQ = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
    const questionJson = JSON.parse(JSON.stringify(nextQ));

    try {
      const { error } = await supabase
        .from('games')
        .update({
          current_question: questionJson,
          player1_answer: null,
          player2_answer: null,
          status: 'playing',
          round: currentGame.round + 1
        })
        .eq('id', currentGame.id);

      if (error) throw error;

      setCurrentGame(prev => prev ? {
        ...prev,
        currentQuestion: nextQ,
        player1Answer: null,
        player2Answer: null,
        status: 'playing',
        round: prev.round + 1
      } : null);
    } catch (error) {
      console.error('[Games] Failed to get next question:', error);
    }
  }, [currentGame, user?.id]);

  // End game
  const endGame = useCallback(async () => {
    if (!currentGame) return;

    try {
      // Update game status
      await supabase
        .from('games')
        .update({ status: 'completed' })
        .eq('id', currentGame.id);

      // Save to history
      await supabase
        .from('game_history')
        .insert({
          room_id: roomId,
          game_type: currentGame.gameType,
          player1_score: currentGame.scorePlayer1,
          player2_score: currentGame.scorePlayer2,
          winner_id: currentGame.scorePlayer1 > currentGame.scorePlayer2 
            ? currentGame.player1Id 
            : currentGame.scorePlayer2 > currentGame.scorePlayer1 
              ? currentGame.player2Id 
              : null
        });

      setCurrentGame(null);

      toast({
        title: 'Game completed! 🎉',
        description: 'Thanks for playing together!'
      });
    } catch (error) {
      console.error('[Games] Failed to end game:', error);
    }
  }, [currentGame, roomId]);

  // Subscribe to game updates
  useEffect(() => {
    if (!roomId || !user?.id) return;

    const channel = supabase
      .channel(`games_${roomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'games',
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        const game = payload.new as any;
        if (!game) return;

        // Update current game if it matches
        if (currentGame?.id === game.id || !currentGame) {
          const gameState: GameState = {
            id: game.id,
            roomId: game.room_id,
            gameType: game.game_type as GameType,
            currentQuestion: game.current_question as unknown as Question,
            player1Id: game.player1_id,
            player2Id: game.player2_id,
            player1Answer: game.player1_answer,
            player2Answer: game.player2_answer,
            scorePlayer1: game.score_player1 || 0,
            scorePlayer2: game.score_player2 || 0,
            status: game.status as any,
            round: game.round || 1
          };

          setCurrentGame(gameState);

          // Check if both players answered
          if (game.player1_answer && game.player2_answer && game.status === 'playing') {
            // Both answered - show results
            toast({
              title: 'Both answered! 💕',
              description: 'Check the results!'
            });
          }
        }

        // Handle new game started by partner
        if (
          payload.eventType === 'INSERT' &&
          game.player1_id !== user.id &&
          game.status === 'waiting'
        ) {
          toast({
            title: 'Partner started a game! 🎮',
            description: 'Join them now!'
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, user?.id, currentGame?.id]);

  // Check for existing game on mount
  useEffect(() => {
    if (!roomId || !user?.id) return;

    const checkExistingGame = async () => {
      try {
        const { data: games } = await supabase
          .from('games')
          .select('*')
          .eq('room_id', roomId)
          .in('status', ['waiting', 'playing', 'answered'])
          .order('created_at', { ascending: false })
          .limit(1);

        if (games && games.length > 0) {
          const game = games[0];
          const gameState: GameState = {
            id: game.id,
            roomId: game.room_id,
            gameType: game.game_type as GameType,
            currentQuestion: game.current_question as unknown as Question,
            player1Id: game.player1_id,
            player2Id: game.player2_id,
            player1Answer: game.player1_answer,
            player2Answer: game.player2_answer,
            scorePlayer1: game.score_player1 || 0,
            scorePlayer2: game.score_player2 || 0,
            status: game.status as any,
            round: game.round || 1
          };

          setCurrentGame(gameState);
        }
      } catch (error) {
        console.error('[Games] Failed to check existing game:', error);
      }
    };

    checkExistingGame();
  }, [roomId, user?.id]);

  return {
    currentGame,
    loading,
    isMyTurn: currentGame?.player1Id === user?.id 
      ? !currentGame?.player1Answer 
      : !currentGame?.player2Answer,
    bothAnswered: !!(currentGame?.player1Answer && currentGame?.player2Answer),
    
    // Actions
    startGame,
    submitAnswer,
    nextQuestion,
    endGame
  };
};
