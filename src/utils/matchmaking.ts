import { supabase } from '../lib/supabase';
import type { Game, GameQueue, UserProfile } from '../types/database';

export interface MatchCandidate {
  user_id: string;
  rating: number;
  username: string;
  queue_time: number;
}

export interface MatchResult {
  player1_id: string;
  player2_id: string;
  player1_rating: number;
  player2_rating: number;
  rating_difference: number;
}

export interface MatchMessage {
  type: 'match_found' | 'match_accepted' | 'match_declined';
  game_id: string;
  player1_id: string;
  player2_id: string;
  timestamp: number;
}

export interface DeclineMessage {
  type: 'match_declined';
  game_id: string;
  declined_by: string;
  other_player: string;
  timestamp: number;
}

export interface QueuePresence {
  user_id: string;
  username: string;
  rating: number;
  joined_at: number;
}

// Configuration
const MATCHMAKING_CONFIG = {
  MAX_RATING_DIFFERENCE: 300, // Maximum rating difference for initial matching
  EXPANDING_RATING_RANGE: 50, // How much to expand the range each iteration
  MAX_EXPANSION_ITERATIONS: 6, // Maximum number of rating range expansions
  MATCH_ACCEPT_TIMEOUT: 30000, // 30 seconds to accept match
  CLEANUP_INTERVAL: 30000, // Cleanup every 30 seconds
  STALE_QUEUE_THRESHOLD: 300, // Remove queue entries older than 5 minutes
} as const;

// Channel names
const CHANNELS = {
  MATCHMAKING: 'matchmaking',
  QUEUE: 'queue',
  GAME: 'game',
} as const;

/**
 * Join the matchmaking queue
 */
export async function joinMatchmakingQueue(userId: string, username: string, rating: number): Promise<boolean> {
  try {
    console.log(`🎯 Joining matchmaking queue: ${username} (${rating})`);
    
    // Test authentication first
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      console.error('❌ Authentication error:', authError);
      return false;
    }
    console.log('✅ User authenticated:', session.user.id);
    
    // Check if user is already in the queue
    try {
      const { data: existingEntry, error: checkError } = await supabase
        .from('game_queue')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing queue entry:', checkError);
        console.error('Error details:', {
          code: checkError.code,
          message: checkError.message,
          details: checkError.details,
          hint: checkError.hint
        });
        return false;
      }

      if (existingEntry) {
        console.log('⚠️ User already in queue:', existingEntry);
        return true; // Return true since they're already in the queue
      }
    } catch (error) {
      console.error('Exception checking existing queue entry:', error);
      return false;
    }
    
    // Add to database queue (trigger will handle matchmaking)
    try {
      console.log('🎯 Attempting to insert into game_queue for user:', userId);
      
      const { data: queueEntry, error: dbError } = await supabase
        .from('game_queue')
        .insert({
          user_id: userId,
        })
        .select()
        .single();

      if (dbError) {
        console.error('Error adding to database queue:', dbError);
        console.error('Error details:', {
          code: dbError.code,
          message: dbError.message,
          details: dbError.details,
          hint: dbError.hint
        });
        return false;
      }

      console.log('✅ Added to database queue:', queueEntry);
      console.log('🎯 Database trigger will automatically process matchmaking');
      
      // Debug: Check if there are other players in queue
      const { data: queuePlayers, error: queueError } = await supabase
        .from('game_queue')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (queueError) {
        console.error('Error checking queue players:', queueError);
      } else {
        console.log('📋 Current queue players:', queuePlayers);
        console.log('👥 Total players in queue:', queuePlayers?.length || 0);
        
        // If there are 2 or more players, check if a game was created
        if (queuePlayers && queuePlayers.length >= 2) {
          console.log('🔍 Multiple players in queue, checking for new games...');
          
          // Check for recent games
          const { data: recentGames, error: gamesError } = await supabase
            .from('games')
            .select('*')
            .eq('status', 'waiting')
            .gte('created_at', new Date(Date.now() - 10000).toISOString()) // Last 10 seconds
            .order('created_at', { ascending: false });
          
          if (gamesError) {
            console.error('Error checking recent games:', gamesError);
          } else {
            console.log('🎮 Recent waiting games:', recentGames);
          }
        }
      }
    } catch (error) {
      console.error('Exception adding to database queue:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error joining matchmaking queue:', error);
    return false;
  }
}

/**
 * Leave the matchmaking queue
 */
export async function leaveMatchmakingQueue(userId: string): Promise<boolean> {
  try {
    console.log(`🚪 Leaving matchmaking queue: ${userId}`);
    
    // Remove from database queue
    const { error: dbError } = await supabase
      .from('game_queue')
      .delete()
      .eq('user_id', userId);

    if (dbError) {
      console.error('Error removing from database queue:', dbError);
      return false;
    }

    console.log('✅ Successfully left matchmaking queue');
    return true;
  } catch (error) {
    console.error('Error leaving matchmaking queue:', error);
    return false;
  }
}

// Note: Matchmaking is now handled by database triggers in PostgreSQL
// The process_matchmaking() function automatically creates matches when players join the queue

// Note: Match creation is now handled by database triggers in PostgreSQL

/**
 * Subscribe to matchmaking events
 */
export function subscribeToMatchmaking(
  userId: string,
  onMatchFound: (message: MatchMessage) => void,
  onMatchAccepted: (message: MatchMessage) => void,
  onMatchDeclined: (message: MatchMessage) => void
) {
  const channel = supabase.channel(CHANNELS.MATCHMAKING);
  
  return channel
    .on('broadcast', { event: 'match_found' }, (payload) => {
      const message = payload.payload as MatchMessage;
      if (message.player1_id === userId || message.player2_id === userId) {
        console.log('🎯 Match found for user:', userId);
        onMatchFound(message);
      }
    })
    .on('broadcast', { event: 'match_accepted' }, (payload) => {
      const message = payload.payload as MatchMessage;
      if (message.player1_id === userId || message.player2_id === userId) {
        console.log('✅ Match accepted for user:', userId);
        onMatchAccepted(message);
      }
    })
    .on('broadcast', { event: 'match_declined' }, (payload) => {
      const message = payload.payload as MatchMessage;
      if (message.player1_id === userId || message.player2_id === userId) {
        console.log('❌ Match declined for user:', userId);
        onMatchDeclined(message);
      }
    })
    .subscribe();
}

/**
 * Accept a match
 */
export async function acceptMatch(gameId: string, userId: string): Promise<boolean> {
  try {
    console.log(`✅ Accepting match: ${gameId} by user: ${userId}`);
    
    // First, verify the game exists and user is a participant
    const { data: game, error: fetchError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (fetchError) {
      console.error('Error fetching game:', fetchError);
      return false;
    }

    if (!game) {
      console.error('Game not found:', gameId);
      return false;
    }

    if (game.player1_id !== userId && game.player2_id !== userId) {
      console.error('User is not a participant in this game:', userId, gameId);
      return false;
    }

    console.log('Game found:', game);
    
    // Update the appropriate acceptance field
    const isPlayer1 = game.player1_id === userId;
    const updateData = isPlayer1 
      ? { player1_accepted: true, updated_at: new Date().toISOString() }
      : { player2_accepted: true, updated_at: new Date().toISOString() };

    const { data: updatedGame, error: updateError } = await supabase
      .from('games')
      .update(updateData)
      .eq('id', gameId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating game acceptance:', updateError);
      return false;
    }

    console.log('Game acceptance updated:', updatedGame);

    console.log('✅ Match acceptance recorded successfully');
    return true;
  } catch (error) {
    console.error('Error accepting match:', error);
    return false;
  }
}

/**
 * Decline a match
 */
export async function declineMatch(gameId: string, userId: string): Promise<boolean> {
  try {
    console.log(`❌ Declining match: ${gameId} by user: ${userId}`);
    
    // First, verify the game exists and user is a participant
    const { data: game, error: fetchError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (fetchError) {
      console.error('Error fetching game:', fetchError);
      return false;
    }

    if (!game) {
      console.error('Game not found:', gameId);
      return false;
    }

    if (game.player1_id !== userId && game.player2_id !== userId) {
      console.error('User is not a participant in this game:', userId, gameId);
      return false;
    }

    console.log('Game found:', game);
    
    // Use the new cancel_game function instead of deleting
    const { data: result, error: cancelError } = await supabase
      .rpc('cancel_game', {
        game_id: gameId,
        player_id: userId
      });

    if (cancelError) {
      console.error('Error canceling game:', cancelError);
      return false;
    }

    if (!result) {
      console.error('Failed to cancel game');
      return false;
    }

    console.log('Game canceled successfully');

    // Remove the declining player from the queue
    const { error: queueError } = await supabase
      .from('game_queue')
      .delete()
      .eq('user_id', userId);

    if (queueError) {
      console.error('Error removing player from queue:', queueError);
      // Don't fail the operation if queue removal fails
    } else {
      console.log('Player removed from queue after declining');
    }

    // Note: The other player will need to manually rejoin the queue
    // This gives them control over when they want to play again
    console.log('📡 Game canceled, other player can manually rejoin when ready');

    console.log('❌ Match declined successfully');
    return true;
  } catch (error) {
    console.error('Error declining match:', error);
    return false;
  }
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
  totalPlayers: number;
  averageWaitTime: number;
  longestWaitTime: number;
}> {
  try {
    const { data: queueEntries, error } = await supabase
      .from('game_queue')
      .select('created_at');

    if (error) {
      console.error('Error fetching queue stats:', error);
      return { totalPlayers: 0, averageWaitTime: 0, longestWaitTime: 0 };
    }

    if (!queueEntries || queueEntries.length === 0) {
      return { totalPlayers: 0, averageWaitTime: 0, longestWaitTime: 0 };
    }

    const now = Date.now();
    const waitTimes = queueEntries.map(entry => 
      Math.floor((now - new Date(entry.created_at).getTime()) / 1000)
    );

    const totalPlayers = queueEntries.length;
    const averageWaitTime = Math.floor(waitTimes.reduce((sum, time) => sum + time, 0) / totalPlayers);
    const longestWaitTime = Math.max(...waitTimes);

    return { totalPlayers, averageWaitTime, longestWaitTime };
  } catch (error) {
    console.error('Error in getQueueStats:', error);
    return { totalPlayers: 0, averageWaitTime: 0, longestWaitTime: 0 };
  }
}

/**
 * Clean up stale queue entries
 */
export async function cleanupStaleQueueEntries(): Promise<number> {
  try {
    const staleThreshold = new Date(Date.now() - MATCHMAKING_CONFIG.STALE_QUEUE_THRESHOLD * 1000);
    
    const { data: staleEntries, error: fetchError } = await supabase
      .from('game_queue')
      .select('id, user_id, created_at')
      .lt('created_at', staleThreshold.toISOString());

    if (fetchError) {
      console.error('Error fetching stale queue entries:', fetchError);
      return 0;
    }

    if (!staleEntries || staleEntries.length === 0) {
      return 0;
    }

    console.log(`🧹 Cleaning up ${staleEntries.length} stale queue entries`);

    const { error: deleteError } = await supabase
      .from('game_queue')
      .delete()
      .lt('created_at', staleThreshold.toISOString());

    if (deleteError) {
      console.error('Error deleting stale queue entries:', deleteError);
      return 0;
    }

    console.log(`✅ Cleaned up ${staleEntries.length} stale queue entries`);
    return staleEntries.length;
  } catch (error) {
    console.error('Error in cleanupStaleQueueEntries:', error);
    return 0;
  }
}

// Start periodic cleanup
let cleanupInterval: NodeJS.Timeout | null = null;

export function startQueueCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }
  
  cleanupInterval = setInterval(async () => {
    try {
      // Clean up stale queue entries
      const removedCount = await cleanupStaleQueueEntries();
      if (removedCount > 0) {
        console.log(`🧹 Cleaned up ${removedCount} stale queue entries`);
      }
      
      // Clean up queue entries for players already in games
      const { data: activePlayers, error: fetchError } = await supabase
        .from('games')
        .select('player1_id, player2_id')
        .in('status', ['waiting', 'active']);
      
      if (fetchError) {
        console.error('Error fetching active players:', fetchError);
      } else if (activePlayers && activePlayers.length > 0) {
        const players = new Set<string>();
        activePlayers.forEach(game => {
          if (game.player1_id) players.add(game.player1_id);
          if (game.player2_id) players.add(game.player2_id);
        });
        
        const playerIds = Array.from(players);
        if (playerIds.length > 0) {
          const { error: deleteError } = await supabase
            .from('game_queue')
            .delete()
            .in('user_id', playerIds);
          
          if (deleteError) {
            console.error('Error cleaning up queue for active players:', deleteError);
          } else {
            console.log(`🧹 Cleaned up queue entries for ${playerIds.length} active players`);
          }
        }
      }
    } catch (error) {
      console.error('Error during queue cleanup:', error);
    }
  }, MATCHMAKING_CONFIG.CLEANUP_INTERVAL);
  
  console.log('🧹 Started queue cleanup interval');
}

export function stopQueueCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log('🧹 Stopped queue cleanup interval');
  }
} 

/**
 * Forfeit a game (give up during active gameplay)
 */
export async function forfeitGame(gameId: string, userId: string): Promise<boolean> {
  try {
    console.log(`🏳️ Forfeiting game: ${gameId} by user: ${userId}`);
    
    const { data: result, error } = await supabase
      .rpc('forfeit_game', {
        game_id: gameId,
        player_id: userId
      });

    if (error) {
      console.error('Error forfeiting game:', error);
      return false;
    }

    if (!result) {
      console.error('Failed to forfeit game');
      return false;
    }

    console.log('✅ Game forfeited successfully');
    return true;
  } catch (error) {
    console.error('Error forfeiting game:', error);
    return false;
  }
}

/**
 * Get achievement statistics for a player (from users table)
 */
export async function getPlayerAchievementStats(userId: string): Promise<{
  total_games_played: number;
  games_won: number;
  games_lost: number;
  games_forfeited: number;
  games_canceled: number;
  opponents_forfeited: number;
  opponents_canceled: number;
} | null> {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        total_games_played,
        games_won,
        games_lost,
        games_forfeited,
        games_canceled,
        opponents_forfeited,
        opponents_canceled
      `)
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error getting user achievement stats:', error);
      return null;
    }

    if (!user) {
      return null;
    }

    return {
      total_games_played: user.total_games_played || 0,
      games_won: user.games_won || 0,
      games_lost: user.games_lost || 0,
      games_forfeited: user.games_forfeited || 0,
      games_canceled: user.games_canceled || 0,
      opponents_forfeited: user.opponents_forfeited || 0,
      opponents_canceled: user.opponents_canceled || 0
    };
  } catch (error) {
    console.error('Error in getPlayerAchievementStats:', error);
    return null;
  }
}

/**
 * Get user's earned achievements
 */
export async function getUserAchievements(userId: string): Promise<{
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  reward_type: string | null;
  reward_value: string | null;
  earned_at: string;
}[]> {
  try {
    const { data, error } = await supabase
      .from('user_achievements')
      .select(`
        achievement_id,
        earned_at,
        achievements (
          id,
          name,
          description,
          icon,
          category,
          reward_type,
          reward_value
        )
      `)
      .eq('user_id', userId);

    if (error) {
      console.error('Error getting user achievements:', error);
      return [];
    }

    if (!data) {
      return [];
    }

    return data.map(item => ({
      id: item.achievements.id,
      name: item.achievements.name,
      description: item.achievements.description,
      icon: item.achievements.icon,
      category: item.achievements.category,
      reward_type: item.achievements.reward_type,
      reward_value: item.achievements.reward_value,
      earned_at: item.earned_at
    }));
  } catch (error) {
    console.error('Error in getUserAchievements:', error);
    return [];
  }
}

/**
 * Get all available achievements
 */
export async function getAllAchievements(): Promise<{
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  requirement_type: string;
  requirement_value: number;
  reward_type: string | null;
  reward_value: string | null;
}[]> {
  try {
    const { data, error } = await supabase
      .from('achievements')
      .select('*')
      .order('requirement_value', { ascending: true });

    if (error) {
      console.error('Error getting all achievements:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getAllAchievements:', error);
    return [];
  }
}

/**
 * Check if a player has earned specific achievements
 */
export async function checkPlayerAchievements(userId: string): Promise<{
  intimidatingPresence: boolean; // Cause 100 players to cancel
  overwhelming: boolean; // Cause 100 players to forfeit
  quickRetreat: boolean; // Forfeit over 100 matches
  veteran: boolean; // Play 1000 games
  champion: boolean; // Win 500 games
  unstoppable: boolean; // Win 1000 games
  sportsman: boolean; // Never forfeit (min 50 games)
}> {
  const stats = await getPlayerAchievementStats(userId);
  const userAchievements = await getUserAchievements(userId);
  
  if (!stats) {
    return {
      intimidatingPresence: false,
      overwhelming: false,
      quickRetreat: false,
      veteran: false,
      champion: false,
      unstoppable: false,
      sportsman: false
    };
  }

  const earnedAchievementNames = userAchievements.map(a => a.name);

  return {
    intimidatingPresence: earnedAchievementNames.includes('Intimidating Presence'),
    overwhelming: earnedAchievementNames.includes('Overwhelming'),
    quickRetreat: earnedAchievementNames.includes('Quick Retreat'),
    veteran: earnedAchievementNames.includes('Veteran Player'),
    champion: earnedAchievementNames.includes('Champion'),
    unstoppable: earnedAchievementNames.includes('Unstoppable'),
    sportsman: earnedAchievementNames.includes('Sportsman')
  };
} 