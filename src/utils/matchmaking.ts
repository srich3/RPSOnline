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
 * Join the matchmaking queue using Presence
 */
export async function joinMatchmakingQueue(userId: string, username: string, rating: number): Promise<boolean> {
  try {
    console.log(`🎯 Joining matchmaking queue: ${username} (${rating})`);
    
    // First, add to database queue
    const { error: dbError } = await supabase
      .from('game_queue')
      .insert({
        user_id: userId,
      });

    if (dbError) {
      console.error('Error adding to database queue:', dbError);
      return false;
    }

    // Join the presence channel
    const channel = supabase.channel(CHANNELS.QUEUE);
    
    const presenceData: QueuePresence = {
      user_id: userId,
      username,
      rating,
      joined_at: Date.now(),
    };

    await channel
      .on('presence', { event: 'sync' }, () => {
        console.log('🔄 Queue presence synced');
        processQueueForMatches();
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('👤 Player joined queue:', newPresences);
        processQueueForMatches();
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('👋 Player left queue:', leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track(presenceData);
          console.log('✅ Joined queue presence channel');
        }
      });

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
    }

    // Leave the presence channel
    const channel = supabase.channel(CHANNELS.QUEUE);
    await channel.untrack();
    await channel.unsubscribe();

    return true;
  } catch (error) {
    console.error('Error leaving matchmaking queue:', error);
    return false;
  }
}

/**
 * Process the queue to find matches using database queries
 */
async function processQueueForMatches(): Promise<void> {
  try {
    console.log('🔄 Processing queue for matches...');
    
    // Get all players in queue with their profiles
    const { data: queueEntries, error: queueError } = await supabase
      .from('game_queue')
      .select(`
        user_id,
        created_at,
        users!inner (
          id,
          username,
          rating
        )
      `)
      .order('created_at', { ascending: true });

    if (queueError) {
      console.error('Error fetching queue:', queueError);
      return;
    }

    if (!queueEntries || queueEntries.length < 2) {
      console.log('Not enough players for matching');
      return;
    }

    console.log(`Processing ${queueEntries.length} players in queue`);

    const processedPlayers = new Set<string>();
    const matches: MatchResult[] = [];

    // Find matches
    for (const entry of queueEntries) {
      if (processedPlayers.has(entry.user_id)) continue;

      const player = {
        user_id: entry.user_id,
        username: entry.users.username,
        rating: entry.users.rating,
        joined_at: new Date(entry.created_at).getTime(),
      };

      const candidates = queueEntries
        .filter(e => e.user_id !== entry.user_id && !processedPlayers.has(e.user_id))
        .map(e => ({
          user_id: e.user_id,
          username: e.users.username,
          rating: e.users.rating,
          joined_at: new Date(e.created_at).getTime(),
        }));

      const match = findBestMatch(player, candidates);

      if (match) {
        matches.push(match);
        processedPlayers.add(match.player1_id);
        processedPlayers.add(match.player2_id);
        console.log(`✅ Found match: ${match.player1_id} vs ${match.player2_id}`);
      }
    }

    // Create games and notify players
    for (const match of matches) {
      await createMatchAndNotify(match);
    }

  } catch (error) {
    console.error('Error processing queue:', error);
  }
}

/**
 * Find the best match for a player
 */
function findBestMatch(player: QueuePresence, candidates: QueuePresence[]): MatchResult | null {
  if (candidates.length === 0) return null;

  // Try expanding rating ranges
  for (let iteration = 0; iteration < MATCHMAKING_CONFIG.MAX_EXPANSION_ITERATIONS; iteration++) {
    const ratingRange = MATCHMAKING_CONFIG.MAX_RATING_DIFFERENCE + 
      (iteration * MATCHMAKING_CONFIG.EXPANDING_RATING_RANGE);

    const eligibleCandidates = candidates.filter(candidate => {
      const ratingDiff = Math.abs(candidate.rating - player.rating);
      const meetsRatingCriteria = ratingDiff <= ratingRange;
      const meetsTimeCriteria = (Date.now() - candidate.joined_at) >= 
        (iteration * 1000); // 1 second per iteration
      
      return meetsRatingCriteria && meetsTimeCriteria;
    });

    if (eligibleCandidates.length > 0) {
      // Find best match (closest rating and longest wait time)
      const bestMatch = eligibleCandidates.reduce((best, current) => {
        const bestScore = calculateMatchScore(player.rating, best.rating, best.joined_at);
        const currentScore = calculateMatchScore(player.rating, current.rating, current.joined_at);
        return currentScore > bestScore ? current : best;
      });

      return {
        player1_id: player.user_id,
        player2_id: bestMatch.user_id,
        player1_rating: player.rating,
        player2_rating: bestMatch.rating,
        rating_difference: Math.abs(player.rating - bestMatch.rating),
      };
    }
  }

  return null;
}

/**
 * Calculate match score
 */
function calculateMatchScore(playerRating: number, opponentRating: number, joinTime: number): number {
  const ratingDifference = Math.abs(playerRating - opponentRating);
  const ratingScore = Math.max(0, 1000 - ratingDifference);
  const timeScore = Math.min((Date.now() - joinTime) / 1000 * 10, 500);
  
  return ratingScore + timeScore;
}

/**
 * Create a match and notify both players
 */
async function createMatchAndNotify(match: MatchResult): Promise<void> {
  try {
    console.log(`🎮 Creating match: ${match.player1_id} vs ${match.player2_id}`);
    
    // Create the game
    const { data: game, error: gameError } = await supabase
      .from('games')
      .insert({
        player1_id: match.player1_id,
        player2_id: match.player2_id,
        status: 'waiting',
        current_player: match.player1_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (gameError) {
      console.error('Error creating game:', gameError);
      return;
    }

    console.log(`✅ Game created: ${game.id}`);

    // Remove both players from queue
    await supabase
      .from('game_queue')
      .delete()
      .in('user_id', [match.player1_id, match.player2_id]);

    // Send match notification to both players
    const matchMessage: MatchMessage = {
      type: 'match_found',
      game_id: game.id,
      player1_id: match.player1_id,
      player2_id: match.player2_id,
      timestamp: Date.now(),
    };

    // Send to matchmaking broadcast channel
    const channel = supabase.channel(CHANNELS.MATCHMAKING);
    await channel.send({
      type: 'broadcast',
      event: 'match_found',
      payload: matchMessage,
    });

    console.log(`📢 Match notification sent for game: ${game.id}`);

  } catch (error) {
    console.error('Error creating match and notifying:', error);
  }
}

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
    await cleanupStaleQueueEntries();
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