import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Auth helpers
export const signInWithEmail = (email: string, password: string) =>
  supabase.auth.signInWithPassword({ email, password });

export const signUpWithEmail = (email: string, password: string) =>
  supabase.auth.signUp({ email, password });

export const signOut = async () => {
  try {
    console.log('Supabase: Starting comprehensive logout...');
    
    // Clear all Supabase auth data
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Error during Supabase signOut:', error);
      return { error };
    }
    
    // Clear localStorage and sessionStorage
    if (typeof window !== 'undefined') {
      // Clear all localStorage items
      localStorage.clear();
      
      // Clear all sessionStorage items
      sessionStorage.clear();
      
      // Clear any cookies that might be set
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
      
      console.log('Supabase: All local storage and cookies cleared');
    }
    
    return { error: null };
  } catch (err) {
    console.error('Error during logout:', err);
    return { error: err };
  }
};

export const signInWithProvider = (provider: 'google' | 'github') => {
  return supabase.auth.signInWithOAuth({ 
    provider,
    options: {
      redirectTo: `${window.location.origin}/dashboard`
    }
  });
};

// User profile helpers
export const createUserProfile = async (userData: Database['public']['Tables']['users']['Insert']) => {
  return supabase.from('users').insert([userData]);
};

export const getUserById = async (userId: string) => {
  return supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
};

export const updateUserProfile = async (userId: string, updates: Database['public']['Tables']['users']['Update']) => {
  return supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
};

export const checkUsernameAvailability = async (username: string) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('username')
      .eq('username', username)
      .maybeSingle();
    
    if (error) {
      console.error('Username check error:', error);
      return { available: false, error };
    }
    
    // If data is null, username is available
    // If data exists, username is taken
    return { available: !data, error: null };
  } catch (err) {
    console.error('Username check exception:', err);
    return { available: false, error: err };
  }
};

// User statistics helpers
export const getUserStats = async (userId: string) => {
  const { data: user, error: userError } = await getUserById(userId);
  if (userError) return { data: null, error: userError };

  const { data: games, error: gamesError } = await getGamesByPlayer(userId);
  if (gamesError) return { data: null, error: gamesError };

  const finishedGames = games?.filter(game => game.status === 'finished') || [];
  const wins = finishedGames.filter(game => game.winner_id === userId).length;
  const losses = finishedGames.filter(game => game.winner_id !== userId && game.winner_id !== null).length;
  const totalGames = finishedGames.length;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

  return {
    data: {
      ...user,
      totalGames,
      wins,
      losses,
      winRate,
      recentGames: games?.slice(0, 5) || []
    },
    error: null
  };
};

export const updateUserStats = async (userId: string, isWin: boolean) => {
  const { data: user, error: userError } = await getUserById(userId);
  if (userError) return { data: null, error: userError };

  const updates: Database['public']['Tables']['users']['Update'] = {
    wins: user.wins + (isWin ? 1 : 0),
    losses: user.losses + (isWin ? 0 : 1),
    rating: calculateNewRating(user.rating, isWin)
  };

  return updateUserProfile(userId, updates);
};

const calculateNewRating = (currentRating: number, isWin: boolean): number => {
  const ratingChange = isWin ? 25 : -15;
  return Math.max(0, currentRating + ratingChange);
};

// Game helpers
export const createGame = async (gameData: Database['public']['Tables']['games']['Insert']) => {
  return supabase
    .from('games')
    .insert([gameData])
    .select()
    .single();
};

export const getGamesByPlayer = async (playerId: string) => {
  return supabase
    .from('games')
    .select(`
      *,
      player1:users!games_player1_id_fkey(username),
      player2:users!games_player2_id_fkey(username)
    `)
    .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
    .order('created_at', { ascending: false });
};

export const getGameById = async (gameId: string) => {
  return supabase
    .from('games')
    .select(`
      *,
      player1:users!games_player1_id_fkey(username),
      player2:users!games_player2_id_fkey(username),
      winner:users!games_winner_id_fkey(username)
    `)
    .eq('id', gameId)
    .single();
};

export const updateGame = async (gameId: string, updates: Database['public']['Tables']['games']['Update']) => {
  return supabase
    .from('games')
    .update(updates)
    .eq('id', gameId)
    .select()
    .single();
};

export const finishGame = async (gameId: string, winnerId: string) => {
  const updates: Database['public']['Tables']['games']['Update'] = {
    status: 'finished',
    winner_id: winnerId
  };

  const { data: game, error: gameError } = await updateGame(gameId, updates);
  if (gameError) return { data: null, error: gameError };

  // Update player stats
  const isPlayer1Win = winnerId === game.player1_id;
  await updateUserStats(game.player1_id, isPlayer1Win);
  if (game.player2_id) {
    await updateUserStats(game.player2_id, !isPlayer1Win);
  }

  return { data: game, error: null };
};

// Game moves helpers
export const addGameMove = async (moveData: Database['public']['Tables']['game_moves']['Insert']) => {
  return supabase
    .from('game_moves')
    .insert([moveData])
    .select()
    .single();
};

export const getGameMoves = async (gameId: string) => {
  return supabase
    .from('game_moves')
    .select('*')
    .eq('game_id', gameId)
    .order('turn_number', { ascending: true });
};

export const getMovesByTurn = async (gameId: string, turnNumber: number) => {
  return supabase
    .from('game_moves')
    .select('*')
    .eq('game_id', gameId)
    .eq('turn_number', turnNumber);
};

// Leaderboard helpers
export const getLeaderboard = async (limit: number = 10) => {
  return supabase
    .from('users')
    .select('id, username, wins, losses, rating')
    .order('rating', { ascending: false })
    .limit(limit);
};

export const getUserRank = async (userId: string) => {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, rating')
    .order('rating', { ascending: false });

  if (error) return { data: null, error };

  const rank = users.findIndex(user => user.id === userId) + 1;
  return { data: rank, error: null };
};

// Search and discovery helpers
export const searchUsers = async (query: string, limit: number = 10) => {
  return supabase
    .from('users')
    .select('id, username, wins, losses, rating')
    .ilike('username', `%${query}%`)
    .order('rating', { ascending: false })
    .limit(limit);
};

export const getActiveGames = async () => {
  return supabase
    .from('games')
    .select(`
      *,
      player1:users!games_player1_id_fkey(username),
      player2:users!games_player2_id_fkey(username)
    `)
    .eq('status', 'active')
    .order('created_at', { ascending: false });
};

export const getWaitingGames = async () => {
  return supabase
    .from('games')
    .select(`
      *,
      player1:users!games_player1_id_fkey(username)
    `)
    .eq('status', 'waiting')
    .is('completion_type', null) // Only include games that haven't been completed/canceled
    .order('created_at', { ascending: false });
};

// Queue helpers
export const joinQueue = async (userId: string) => {
  return supabase
    .from('game_queue')
    .insert([{ user_id: userId }])
    .select()
    .single();
};

export const leaveQueue = async (userId: string) => {
  return supabase
    .from('game_queue')
    .delete()
    .eq('user_id', userId);
};

export const getQueueStatus = async () => {
  return supabase
    .from('game_queue')
    .select(`
      *,
      user:users!game_queue_user_id_fkey(username)
    `)
    .order('created_at', { ascending: true });
};

export const findMatch = async (userId: string) => {
  // First, check if there are any waiting games
  const { data: waitingGames, error: waitingError } = await getWaitingGames();
  if (waitingError) return { data: null, error: waitingError };

  // Find a game where the current user is not the player1
  const availableGame = waitingGames?.find(game => game.player1_id !== userId);
  
  if (availableGame) {
    // Join existing game
    const { data: updatedGame, error: updateError } = await updateGame(availableGame.id, {
      player2_id: userId,
      status: 'active'
    });
    
    if (updateError) return { data: null, error: updateError };
    
    // Remove both players from queue
    await leaveQueue(userId);
    await leaveQueue(availableGame.player1_id);
    
    return { data: updatedGame, error: null };
  } else {
    // Create new waiting game
    const { data: newGame, error: createError } = await createGame({
      player1_id: userId,
      status: 'waiting'
    });
    
    if (createError) return { data: null, error: createError };
    
    return { data: newGame, error: null };
  }
};

// Batch operations helpers
export const batchUpdateUserStats = async (updates: Array<{ userId: string; isWin: boolean }>) => {
  const results = await Promise.all(
    updates.map(({ userId, isWin }) => updateUserStats(userId, isWin))
  );
  
  return results;
};

export const getRecentActivity = async (userId: string, limit: number = 10) => {
  const { data: games, error } = await supabase
    .from('games')
    .select(`
      *,
      player1:users!games_player1_id_fkey(username),
      player2:users!games_player2_id_fkey(username),
      winner:users!games_winner_id_fkey(username)
    `)
    .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
    .eq('status', 'finished')
    .order('created_at', { ascending: false })
    .limit(limit);

  return { data: games, error };
};

// Real-time subscription helpers
export const subscribeToTable = (table: string, callback: (payload: { [key: string]: unknown }) => void) => {
  return supabase.channel(table)
    .on('postgres_changes', { event: '*', schema: 'public', table }, callback)
    .subscribe();
};

export const subscribeToGame = (gameId: string, callback: (payload: { [key: string]: unknown }) => void) => {
  return supabase.channel(`game:${gameId}`)
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, 
      callback
    )
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'game_moves', filter: `game_id=eq.${gameId}` }, 
      callback
    )
    .subscribe();
};

export const subscribeToUserProfile = (userId: string, callback: (payload: { [key: string]: unknown }) => void) => {
  return supabase.channel(`user:${userId}`)
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'users', filter: `id=eq.${userId}` }, 
      callback
    )
    .subscribe();
};

export const subscribeToQueue = (callback: (payload: { [key: string]: unknown }) => void) => {
  return supabase.channel('queue')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'game_queue' }, 
      callback
    )
    .subscribe();
};

export const subscribeToLeaderboard = (callback: (payload: { [key: string]: unknown }) => void) => {
  return supabase.channel('leaderboard')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'users' }, 
      callback
    )
    .subscribe();
}; 