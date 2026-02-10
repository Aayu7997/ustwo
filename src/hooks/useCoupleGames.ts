import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

export type GameType = 
  | 'would_you_rather' 
  | 'truth_or_dare' 
  | 'love_quiz' 
  | 'compatibility'
  | 'dirty_confessions'
  | 'power_play'
  | 'mood_roulette'
  | 'emoji_dare';

export interface Question {
  id: string;
  text: string;
  options?: string[];
  type?: 'truth' | 'dare' | 'confess' | 'challenge' | 'mood' | 'emoji';
  category?: string;
  spiceLevel?: number; // 1-5
  nsfw?: boolean;
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

// ─── Question Banks ───

const WOULD_YOU_RATHER: Question[] = [
  { id: 'wyr1', text: 'Would you rather have a movie night or a game night?', options: ['Movie night', 'Game night'], spiceLevel: 1 },
  { id: 'wyr2', text: 'Would you rather travel to the past or the future?', options: ['Past', 'Future'], spiceLevel: 1 },
  { id: 'wyr3', text: 'Would you rather have breakfast in bed or a surprise dinner?', options: ['Breakfast in bed', 'Surprise dinner'], spiceLevel: 1 },
  { id: 'wyr4', text: 'Would you rather dance in the rain or watch the stars?', options: ['Dance in rain', 'Watch stars'], spiceLevel: 1 },
  { id: 'wyr5', text: 'Would you rather have a cozy night in or an adventurous night out?', options: ['Cozy night in', 'Adventurous night out'], spiceLevel: 1 },
  { id: 'wyr6', text: 'Would you rather receive flowers or chocolates?', options: ['Flowers', 'Chocolates'], spiceLevel: 1 },
  { id: 'wyr7', text: 'Would you rather have a beach vacation or mountain getaway?', options: ['Beach', 'Mountain'], spiceLevel: 1 },
  { id: 'wyr8', text: 'Would you rather cook together or order takeout?', options: ['Cook together', 'Order takeout'], spiceLevel: 1 },
  { id: 'wyr9', text: 'Would you rather watch sunrise or sunset together?', options: ['Sunrise', 'Sunset'], spiceLevel: 1 },
  { id: 'wyr10', text: 'Would you rather have a long hug or a sweet kiss?', options: ['Long hug', 'Sweet kiss'], spiceLevel: 2 },
  // NSFW
  { id: 'wyr_n1', text: 'Would you rather be blindfolded or handcuffed?', options: ['Blindfolded', 'Handcuffed'], spiceLevel: 4, nsfw: true },
  { id: 'wyr_n2', text: 'Would you rather receive a sensual massage or give one?', options: ['Receive', 'Give'], spiceLevel: 3, nsfw: true },
  { id: 'wyr_n3', text: 'Would you rather roleplay or try something new in bed?', options: ['Roleplay', 'Something new'], spiceLevel: 5, nsfw: true },
];

const TRUTH_OR_DARE: Question[] = [
  { id: 'tod1', text: 'What was your first impression of me?', type: 'truth', spiceLevel: 1 },
  { id: 'tod2', text: 'What do you love most about our relationship?', type: 'truth', spiceLevel: 1 },
  { id: 'tod3', text: 'Send your partner a voice message saying "I love you"', type: 'dare', spiceLevel: 1 },
  { id: 'tod4', text: 'What is your favorite memory of us together?', type: 'truth', spiceLevel: 1 },
  { id: 'tod5', text: 'Do your best impression of your partner', type: 'dare', spiceLevel: 2 },
  { id: 'tod6', text: 'What song reminds you of me?', type: 'truth', spiceLevel: 1 },
  { id: 'tod7', text: 'Write a short love poem for your partner right now', type: 'dare', spiceLevel: 2 },
  { id: 'tod8', text: 'What is something you want us to do together?', type: 'truth', spiceLevel: 1 },
  { id: 'tod9', text: 'Give your partner 3 genuine compliments', type: 'dare', spiceLevel: 1 },
  { id: 'tod10', text: 'What makes our relationship special?', type: 'truth', spiceLevel: 1 },
  // Spicy
  { id: 'tod_s1', text: 'What is your biggest fantasy about us?', type: 'truth', spiceLevel: 4, nsfw: true },
  { id: 'tod_s2', text: 'Do a seductive dance for 30 seconds on camera', type: 'dare', spiceLevel: 4, nsfw: true },
  { id: 'tod_s3', text: 'Whisper something naughty to your partner', type: 'dare', spiceLevel: 5, nsfw: true },
];

const LOVE_QUIZ: Question[] = [
  { id: 'lq1', text: "What is your partner's favorite color?", category: 'preferences', spiceLevel: 1 },
  { id: 'lq2', text: "What is your partner's dream vacation destination?", category: 'dreams', spiceLevel: 1 },
  { id: 'lq3', text: "What is your partner's favorite food?", category: 'preferences', spiceLevel: 1 },
  { id: 'lq4', text: "What is your partner's biggest fear?", category: 'deep', spiceLevel: 1 },
  { id: 'lq5', text: "What would your partner's ideal date night be?", category: 'preferences', spiceLevel: 1 },
  { id: 'lq6', text: "What is your partner's love language?", category: 'deep', spiceLevel: 2 },
  { id: 'lq7', text: "What makes your partner laugh the most?", category: 'personality', spiceLevel: 1 },
  { id: 'lq8', text: "What is your partner's comfort movie/show?", category: 'preferences', spiceLevel: 1 },
  { id: 'lq9', text: "What is one thing on your partner's bucket list?", category: 'dreams', spiceLevel: 1 },
  { id: 'lq10', text: "How does your partner like to relax?", category: 'preferences', spiceLevel: 1 },
];

const COMPATIBILITY: Question[] = [
  { id: 'comp1', text: 'How important is quality time to you? (1-10)', options: ['1-3', '4-6', '7-10'], spiceLevel: 1 },
  { id: 'comp2', text: 'How do you prefer to show affection?', options: ['Words', 'Touch', 'Gifts', 'Acts of service'], spiceLevel: 1 },
  { id: 'comp3', text: 'What is your ideal weekend activity?', options: ['Adventure', 'Relaxation', 'Social', 'Creative'], spiceLevel: 1 },
  { id: 'comp4', text: 'How do you handle disagreements?', options: ['Talk it out', 'Take space', 'Compromise quickly'], spiceLevel: 1 },
  { id: 'comp5', text: 'What role does family play in your life?', options: ['Very important', 'Somewhat important', 'Independent'], spiceLevel: 1 },
];

const DIRTY_CONFESSIONS: Question[] = [
  { id: 'dc1', text: 'Confess: What is the most romantic thing you have ever secretly wanted to do?', type: 'confess', spiceLevel: 2 },
  { id: 'dc2', text: 'Confess: Have you ever had a dream about someone else while in a relationship?', type: 'confess', spiceLevel: 3 },
  { id: 'dc3', text: 'Confess: What is one thing about your partner that drives you wild?', type: 'confess', spiceLevel: 3, nsfw: true },
  { id: 'dc4', text: 'Confess: What is your guilty pleasure that your partner does not know about?', type: 'confess', spiceLevel: 2 },
  { id: 'dc5', text: 'Confess: Describe your ideal "perfect night" with your partner', type: 'confess', spiceLevel: 3, nsfw: true },
  { id: 'dc6', text: 'Confess: What was the most embarrassing thing you did to impress your partner?', type: 'confess', spiceLevel: 2 },
  { id: 'dc7', text: 'Confess: What is one thing you are too shy to ask for?', type: 'confess', spiceLevel: 4, nsfw: true },
  { id: 'dc8', text: 'Confess: When was the last time you had a naughty thought about your partner?', type: 'confess', spiceLevel: 4, nsfw: true },
];

const POWER_PLAY: Question[] = [
  { id: 'pp1', text: '🔥 Challenge: Your partner must do whatever you say for the next 2 minutes', type: 'challenge', spiceLevel: 3, nsfw: true },
  { id: 'pp2', text: '🎯 Tease: Describe what you would do if your partner was right next to you', type: 'challenge', spiceLevel: 4, nsfw: true },
  { id: 'pp3', text: '💪 Dominance: Tell your partner 3 things they must do before the next round', type: 'challenge', spiceLevel: 3, nsfw: true },
  { id: 'pp4', text: '😈 Challenge: Make your partner blush with just words', type: 'challenge', spiceLevel: 3 },
  { id: 'pp5', text: '🔥 Power move: Send a voice note with your most seductive voice', type: 'challenge', spiceLevel: 4, nsfw: true },
  { id: 'pp6', text: '💋 Challenge: Describe your partner using only romantic metaphors', type: 'challenge', spiceLevel: 2 },
];

const MOOD_ROULETTE: Question[] = [
  { id: 'mr1', text: '🌹 Romantic: Share a memory that made you fall deeper in love', type: 'mood', spiceLevel: 1, category: 'romantic' },
  { id: 'mr2', text: '😂 Funny: Do your funniest impression of a celebrity', type: 'mood', spiceLevel: 1, category: 'funny' },
  { id: 'mr3', text: '🥺 Emotional: Tell your partner something you have never told them', type: 'mood', spiceLevel: 2, category: 'deep' },
  { id: 'mr4', text: '🔥 Spicy: What is the boldest thing you want to try together?', type: 'mood', spiceLevel: 4, category: 'spicy', nsfw: true },
  { id: 'mr5', text: '😊 Sweet: Write 5 things you love about your partner', type: 'mood', spiceLevel: 1, category: 'sweet' },
  { id: 'mr6', text: '🤔 Deep: If you could relive one moment with your partner, what would it be?', type: 'mood', spiceLevel: 2, category: 'deep' },
  { id: 'mr7', text: '🎉 Playful: Create a silly nickname for your partner and explain why', type: 'mood', spiceLevel: 1, category: 'playful' },
  { id: 'mr8', text: '💭 Dreamy: Describe your dream date with your partner in detail', type: 'mood', spiceLevel: 2, category: 'romantic' },
];

const EMOJI_DARE: Question[] = [
  { id: 'ed1', text: '😘 Send your partner a selfie doing this emoji face', type: 'emoji', spiceLevel: 1 },
  { id: 'ed2', text: '🤪 Do 10 seconds of the silliest dance you can', type: 'emoji', spiceLevel: 1 },
  { id: 'ed3', text: '😍 Describe why you are attracted to your partner using only emojis (10+)', type: 'emoji', spiceLevel: 2 },
  { id: 'ed4', text: '🥵 Strike your most confident pose on camera', type: 'emoji', spiceLevel: 3, nsfw: true },
  { id: 'ed5', text: '💀 Tell the most embarrassing story from your life', type: 'emoji', spiceLevel: 2 },
  { id: 'ed6', text: '👑 Act like royalty for 30 seconds', type: 'emoji', spiceLevel: 1 },
  { id: 'ed7', text: '🎭 Act out a movie scene and your partner has to guess it', type: 'emoji', spiceLevel: 1 },
  { id: 'ed8', text: '💃 Do a dramatic slow-motion walk across the room', type: 'emoji', spiceLevel: 1 },
];

const getQuestionBank = (gameType: GameType): Question[] => {
  switch (gameType) {
    case 'would_you_rather': return WOULD_YOU_RATHER;
    case 'truth_or_dare': return TRUTH_OR_DARE;
    case 'love_quiz': return LOVE_QUIZ;
    case 'compatibility': return COMPATIBILITY;
    case 'dirty_confessions': return DIRTY_CONFESSIONS;
    case 'power_play': return POWER_PLAY;
    case 'mood_roulette': return MOOD_ROULETTE;
    case 'emoji_dare': return EMOJI_DARE;
    default: return WOULD_YOU_RATHER;
  }
};

export const useCoupleGames = ({ roomId, partnerId }: UseCoupleGamesProps) => {
  const { user } = useAuth();
  const [currentGame, setCurrentGame] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(false);
  const [nsfwEnabled, setNsfwEnabled] = useState(false);
  const [spiceLevel, setSpiceLevel] = useState(3); // 1-5

  const startGame = useCallback(async (gameType: GameType) => {
    if (!user?.id || !roomId) return null;
    setLoading(true);
    try {
      const questionBank = getQuestionBank(gameType);
      const filtered = questionBank.filter(q => 
        (nsfwEnabled || !q.nsfw) && (q.spiceLevel || 1) <= spiceLevel
      );
      if (filtered.length === 0) {
        toast({ title: 'No questions available', description: 'Try increasing spice level or enabling NSFW', variant: 'destructive' });
        setLoading(false);
        return null;
      }
      const firstQuestion = filtered[Math.floor(Math.random() * filtered.length)];
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
      toast({ title: 'Game started! 🎮', description: `Playing ${gameType.replace(/_/g, ' ')}` });
      return gameState;
    } catch (error) {
      console.error('[Games] Failed to start game:', error);
      toast({ title: 'Failed to start game', variant: 'destructive' });
      return null;
    } finally {
      setLoading(false);
    }
  }, [user?.id, roomId, partnerId, nsfwEnabled, spiceLevel]);

  const submitAnswer = useCallback(async (answer: any) => {
    if (!currentGame || !user?.id) return;
    const isPlayer1 = currentGame.player1Id === user.id;
    const answerField = isPlayer1 ? 'player1_answer' : 'player2_answer';
    try {
      const { error } = await supabase
        .from('games')
        .update({ [answerField]: answer, status: 'playing' })
        .eq('id', currentGame.id);
      if (error) throw error;
      setCurrentGame(prev => prev ? {
        ...prev,
        [isPlayer1 ? 'player1Answer' : 'player2Answer']: answer,
        status: 'playing'
      } : null);
      toast({ title: 'Answer submitted! ✓', description: 'Waiting for partner...' });
    } catch (error) {
      console.error('[Games] Failed to submit answer:', error);
      toast({ title: 'Failed to submit answer', variant: 'destructive' });
    }
  }, [currentGame, user?.id]);

  const nextQuestion = useCallback(async () => {
    if (!currentGame || !user?.id) return;
    const questionBank = getQuestionBank(currentGame.gameType);
    const filtered = questionBank.filter(q => 
      (nsfwEnabled || !q.nsfw) && (q.spiceLevel || 1) <= spiceLevel
    );
    const usedIds = [currentGame.currentQuestion?.id];
    const available = filtered.filter(q => !usedIds.includes(q.id));
    if (available.length === 0) {
      await endGame();
      return;
    }
    const nextQ = available[Math.floor(Math.random() * available.length)];
    const questionJson = JSON.parse(JSON.stringify(nextQ));
    try {
      // Update scores if both matched
      let newScore1 = currentGame.scorePlayer1;
      let newScore2 = currentGame.scorePlayer2;
      if (currentGame.player1Answer && currentGame.player2Answer && currentGame.player1Answer === currentGame.player2Answer) {
        newScore1 += 1;
        newScore2 += 1;
      }
      const { error } = await supabase
        .from('games')
        .update({
          current_question: questionJson,
          player1_answer: null,
          player2_answer: null,
          status: 'playing',
          round: currentGame.round + 1,
          score_player1: newScore1,
          score_player2: newScore2
        })
        .eq('id', currentGame.id);
      if (error) throw error;
      setCurrentGame(prev => prev ? {
        ...prev,
        currentQuestion: nextQ,
        player1Answer: null,
        player2Answer: null,
        status: 'playing',
        round: prev.round + 1,
        scorePlayer1: newScore1,
        scorePlayer2: newScore2
      } : null);
    } catch (error) {
      console.error('[Games] Failed to get next question:', error);
    }
  }, [currentGame, user?.id, nsfwEnabled, spiceLevel]);

  const endGame = useCallback(async () => {
    if (!currentGame) return;
    try {
      await supabase.from('games').update({ status: 'completed' }).eq('id', currentGame.id);
      await supabase.from('game_history').insert({
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
      toast({ title: 'Game completed! 🎉', description: 'Thanks for playing together!' });
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
        event: '*', schema: 'public', table: 'games',
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        const game = payload.new as any;
        if (!game) return;
        if (currentGame?.id === game.id || !currentGame) {
          const gameState: GameState = {
            id: game.id, roomId: game.room_id,
            gameType: game.game_type as GameType,
            currentQuestion: game.current_question as unknown as Question,
            player1Id: game.player1_id, player2Id: game.player2_id,
            player1Answer: game.player1_answer, player2Answer: game.player2_answer,
            scorePlayer1: game.score_player1 || 0, scorePlayer2: game.score_player2 || 0,
            status: game.status as any, round: game.round || 1
          };
          setCurrentGame(gameState);
          if (game.player1_answer && game.player2_answer && game.status === 'playing') {
            toast({ title: 'Both answered! 💕', description: 'Check the results!' });
          }
        }
        if (payload.eventType === 'INSERT' && game.player1_id !== user.id && game.status === 'waiting') {
          toast({ title: 'Partner started a game! 🎮', description: 'Join them now!' });
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId, user?.id, currentGame?.id]);

  // Check for existing game on mount
  useEffect(() => {
    if (!roomId || !user?.id) return;
    const checkExistingGame = async () => {
      try {
        const { data: games } = await supabase
          .from('games').select('*').eq('room_id', roomId)
          .in('status', ['waiting', 'playing', 'answered'])
          .order('created_at', { ascending: false }).limit(1);
        if (games && games.length > 0) {
          const game = games[0];
          setCurrentGame({
            id: game.id, roomId: game.room_id,
            gameType: game.game_type as GameType,
            currentQuestion: game.current_question as unknown as Question,
            player1Id: game.player1_id, player2Id: game.player2_id,
            player1Answer: game.player1_answer, player2Answer: game.player2_answer,
            scorePlayer1: game.score_player1 || 0, scorePlayer2: game.score_player2 || 0,
            status: game.status as any, round: game.round || 1
          });
        }
      } catch (error) {
        console.error('[Games] Failed to check existing game:', error);
      }
    };
    checkExistingGame();
  }, [roomId, user?.id]);

  return {
    currentGame, loading,
    nsfwEnabled, setNsfwEnabled,
    spiceLevel, setSpiceLevel,
    isMyTurn: currentGame?.player1Id === user?.id 
      ? !currentGame?.player1Answer 
      : !currentGame?.player2Answer,
    bothAnswered: !!(currentGame?.player1Answer && currentGame?.player2Answer),
    startGame, submitAnswer, nextQuestion, endGame
  };
};
