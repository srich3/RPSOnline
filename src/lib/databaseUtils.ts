import { supabase } from './supabase';
import type { Database } from '../types/database';

type User = Database['public']['Tables']['users']['Row'];
type Game = Database['public']['Tables']['games']['Row'];
type GameMove = Database['public']['Tables']['game_moves']['Row'];

// Data transformation utilities
export const transformGameData = (game: Game & { 
  player1?: { username: string } | null, 
  player2?: { username: string } | null,
  winner?: { username: string } | null
}) => {
  return {
    ...game,
    player1Name: game.player1?.username || 'Unknown',
    player2Name: game.player2?.username || 'Unknown',
    winnerName: game.winner?.username || null,
    isFinished: game.status === 'finished',
    isActive: game.status === 'active',
    isWaiting: game.status === 'waiting'
  };
};

export const transformUserData = (user: User) => {
  const totalGames = user.wins + user.losses;
  const winRate = totalGames > 0 ? Math.round((user.wins / totalGames) * 100) : 0;
  
  return {
    ...user,
    totalGames,
    winRate,
    ratingTier: getRatingTier(user.rating)
  };
};

export const getRatingTier = (rating: number) => {
  if (rating >= 2000) return { name: 'Master', color: 'purple', bg: 'bg-purple-500/20' };
  if (rating >= 1500) return { name: 'Expert', color: 'blue', bg: 'bg-blue-500/20' };
  if (rating >= 1000) return { name: 'Veteran', color: 'green', bg: 'bg-green-500/20' };
  if (rating >= 500) return { name: 'Rookie', color: 'yellow', bg: 'bg-yellow-500/20' };
  return { name: 'Novice', color: 'gray', bg: 'bg-gray-500/20' };
};

// Advanced query helpers
export const getGameHistory = async (userId: string, limit: number = 20) => {
  const { data: games, error } = await supabase
    .from('games')
    .select(`
      *,
      player1:users!games_player1_id_fkey(username),
      player2:users!games_player2_id_fkey(username),
      winner:users!games_winner_id_fkey(username),
      moves:game_moves(*)
    `)
    .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
    .eq('status', 'finished')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return { data: null, error };

  const transformedGames = games?.map(game => ({
    ...transformGameData(game),
    moves: game.moves || [],
    playerRole: game.player1_id === userId ? 'player1' : 'player2',
    result: game.winner_id === userId ? 'win' : 'loss'
  }));

  return { data: transformedGames, error: null };
};

export const getPlayerStats = async (userId: string) => {
  const { data: games, error } = await supabase
    .from('games')
    .select('*')
    .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
    .eq('status', 'finished');

  if (error) return { data: null, error };

  const stats = {
    totalGames: games?.length || 0,
    wins: games?.filter(g => g.winner_id === userId).length || 0,
    losses: games?.filter(g => g.winner_id !== userId && g.winner_id !== null).length || 0,
    winRate: 0,
    averageGameDuration: 0,
    longestWinStreak: 0,
    currentStreak: 0
  };

  stats.winRate = stats.totalGames > 0 ? Math.round((stats.wins / stats.totalGames) * 100) : 0;

  // Calculate streaks
  const currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  games?.forEach(game => {
    const isWin = game.winner_id === userId;
    if (isWin) {
      tempStreak++;
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
    } else {
      tempStreak = 0;
    }
  });

  stats.longestWinStreak = longestStreak;
  stats.currentStreak = tempStreak;

  return { data: stats, error: null };
};

export const getGameAnalytics = async (gameId: string) => {
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select(`
      *,
      player1:users!games_player1_id_fkey(username),
      player2:users!games_player2_id_fkey(username),
      winner:users!games_winner_id_fkey(username)
    `)
    .eq('id', gameId)
    .single();

  if (gameError) return { data: null, error: gameError };

  const { data: moves, error: movesError } = await supabase
    .from('game_moves')
    .select('*')
    .eq('game_id', gameId)
    .order('turn_number', { ascending: true });

  if (movesError) return { data: null, error: movesError };

  const analytics = {
    game: transformGameData(game),
    moves: moves || [],
    totalTurns: moves?.length || 0,
    player1Moves: moves?.filter(m => m.player_id === game.player1_id) || [],
    player2Moves: moves?.filter(m => m.player_id === game.player2_id) || [],
    moveTypes: {
      claim: moves?.filter(m => m.action_type === 'claim').length || 0,
      attack: moves?.filter(m => m.action_type === 'attack').length || 0,
      defend: moves?.filter(m => m.action_type === 'defend').length || 0,
      conquer: moves?.filter(m => m.action_type === 'conquer').length || 0
    }
  };

  return { data: analytics, error: null };
};

// Performance and caching helpers
export const cacheUserProfile = (userId: string, profile: User) => {
  if (typeof window !== 'undefined') {
    const cacheKey = `user_profile_${userId}`;
    const cacheData = {
      profile,
      timestamp: Date.now()
    };
    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
  }
};

export const getCachedUserProfile = (userId: string): User | null => {
  if (typeof window !== 'undefined') {
    const cacheKey = `user_profile_${userId}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (cached) {
      const { profile, timestamp } = JSON.parse(cached);
      const cacheAge = Date.now() - timestamp;
      
      // Cache expires after 5 minutes
      if (cacheAge < 5 * 60 * 1000) {
        return profile;
      } else {
        localStorage.removeItem(cacheKey);
      }
    }
  }
  
  return null;
};

// Batch operations
export const batchGetUserProfiles = async (userIds: string[]) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .in('id', userIds);

  if (error) return { data: null, error };

  const profiles = data?.map(transformUserData) || [];
  return { data: profiles, error: null };
};

export const batchGetGameSummaries = async (gameIds: string[]) => {
  const { data, error } = await supabase
    .from('games')
    .select(`
      *,
      player1:users!games_player1_id_fkey(username),
      player2:users!games_player2_id_fkey(username),
      winner:users!games_winner_id_fkey(username)
    `)
    .in('id', gameIds)
    .order('created_at', { ascending: false });

  if (error) return { data: null, error };

  const summaries = data?.map(transformGameData) || [];
  return { data: summaries, error: null };
};

// Search and filtering
export const searchGames = async (query: string, filters: {
  status?: 'waiting' | 'active' | 'finished';
  playerId?: string;
  limit?: number;
}) => {
  let queryBuilder = supabase
    .from('games')
    .select(`
      *,
      player1:users!games_player1_id_fkey(username),
      player2:users!games_player2_id_fkey(username),
      winner:users!games_winner_id_fkey(username)
    `);

  if (filters.status) {
    queryBuilder = queryBuilder.eq('status', filters.status);
  }

  if (filters.playerId) {
    queryBuilder = queryBuilder.or(`player1_id.eq.${filters.playerId},player2_id.eq.${filters.playerId}`);
  }

  const { data, error } = await queryBuilder
    .order('created_at', { ascending: false })
    .limit(filters.limit || 10);

  if (error) return { data: null, error };

  const transformedGames = data?.map(transformGameData) || [];
  return { data: transformedGames, error: null };
};

// Data validation helpers
export const validateGameState = (gameState: any) => {
  const requiredFields = ['board', 'currentPlayer', 'turnNumber'];
  const missingFields = requiredFields.filter(field => !(field in gameState));
  
  if (missingFields.length > 0) {
    return { valid: false, errors: [`Missing required fields: ${missingFields.join(', ')}`] };
  }

  if (!Array.isArray(gameState.board) || gameState.board.length !== 9) {
    return { valid: false, errors: ['Invalid board state'] };
  }

  return { valid: true, errors: [] };
};

export const validateMove = (move: any) => {
  const requiredFields = ['game_id', 'player_id', 'turn_number', 'action_type', 'target_square', 'points_spent'];
  const missingFields = requiredFields.filter(field => !(field in move));
  
  if (missingFields.length > 0) {
    return { valid: false, errors: [`Missing required fields: ${missingFields.join(', ')}`] };
  }

  const validActionTypes = ['claim', 'attack', 'defend', 'conquer'];
  if (!validActionTypes.includes(move.action_type)) {
    return { valid: false, errors: ['Invalid action type'] };
  }

  if (move.target_square < 0 || move.target_square > 8) {
    return { valid: false, errors: ['Invalid target square'] };
  }

  if (move.points_spent < 0) {
    return { valid: false, errors: ['Invalid points spent'] };
  }

  return { valid: true, errors: [] };
};

// Error handling utilities
export const handleDatabaseError = (error: any) => {
  console.error('Database error:', error);
  
  if (error.code === '23505') {
    return { message: 'This record already exists', type: 'duplicate' };
  }
  
  if (error.code === '23503') {
    return { message: 'Referenced record does not exist', type: 'foreign_key' };
  }
  
  if (error.code === '42P01') {
    return { message: 'Table does not exist', type: 'table_not_found' };
  }
  
  return { message: 'An unexpected error occurred', type: 'unknown' };
}; 