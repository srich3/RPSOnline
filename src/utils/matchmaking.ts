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
    
    // Add to database queue (trigger will handle matchmaking)
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
    
    // Update game status
    const { error: gameError } = await supabase
      .from('games')
      .update({ 
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', gameId);

    if (gameError) {
      console.error('Error updating game:', gameError);
      return false;
    }

    // Send acceptance notification
    const channel = supabase.channel(CHANNELS.MATCHMAKING);
    await channel.send({
      type: 'broadcast',
      event: 'match_accepted',
      payload: {
        type: 'match_accepted',
        game_id: gameId,
        player1_id: userId,
        player2_id: '', // Will be filled by the other player
        timestamp: Date.now(),
      },
    });

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
    
    // Delete the game
    const { error: gameError } = await supabase
      .from('games')
      .delete()
      .eq('id', gameId);

    if (gameError) {
      console.error('Error deleting game:', gameError);
      return false;
    }

    // Send decline notification
    const channel = supabase.channel(CHANNELS.MATCHMAKING);
    await channel.send({
      type: 'broadcast',
      event: 'match_declined',
      payload: {
        type: 'match_declined',
        game_id: gameId,
        player1_id: userId,
        player2_id: '', // Will be filled by the other player
        timestamp: Date.now(),
      },
    });

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