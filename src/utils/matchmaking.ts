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

// Configuration
const MATCHMAKING_CONFIG = {
  MAX_RATING_DIFFERENCE: 300, // Maximum rating difference for initial matching
  EXPANDING_RATING_RANGE: 50, // How much to expand the range each iteration
  MAX_EXPANSION_ITERATIONS: 6, // Maximum number of rating range expansions
  MIN_QUEUE_TIME: 10, // Minimum seconds in queue before expanding range
  MAX_QUEUE_TIME: 120, // Maximum seconds in queue before forcing match
  CLEANUP_INTERVAL: 30000, // Cleanup every 30 seconds
  STALE_QUEUE_THRESHOLD: 300, // Remove queue entries older than 5 minutes
} as const;

/**
 * Find the best match for a player in the queue
 */
export async function findMatch(playerId: string, playerRating: number): Promise<MatchResult | null> {
  try {
    console.log(`🔍 Finding match for player ${playerId} (rating: ${playerRating})`);
    
    // Get all players in queue except the current player
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
      .neq('user_id', playerId)
      .order('created_at', { ascending: true });

    if (queueError) {
      console.error('Error fetching queue entries:', queueError);
      return null;
    }

    if (!queueEntries || queueEntries.length === 0) {
      console.log('No other players in queue');
      return null;
    }

    // Convert to match candidates
    const candidates: MatchCandidate[] = queueEntries.map(entry => ({
      user_id: entry.user_id,
      rating: entry.users.rating,
      username: entry.users.username,
      queue_time: Math.floor((Date.now() - new Date(entry.created_at).getTime()) / 1000),
    }));

    console.log(`Found ${candidates.length} potential opponents`);

    // Try to find a match with expanding rating range
    for (let iteration = 0; iteration < MATCHMAKING_CONFIG.MAX_EXPANSION_ITERATIONS; iteration++) {
      const ratingRange = MATCHMAKING_CONFIG.MAX_RATING_DIFFERENCE + 
        (iteration * MATCHMAKING_CONFIG.EXPANDING_RATING_RANGE);
      
      const minRating = playerRating - ratingRange;
      const maxRating = playerRating + ratingRange;

      // Filter candidates by rating range
      const eligibleCandidates = candidates.filter(candidate => {
        const ratingDiff = Math.abs(candidate.rating - playerRating);
        const meetsRatingCriteria = ratingDiff <= ratingRange;
        const meetsTimeCriteria = candidate.queue_time >= 
          (iteration * MATCHMAKING_CONFIG.MIN_QUEUE_TIME);
        
        return meetsRatingCriteria && meetsTimeCriteria;
      });

      if (eligibleCandidates.length > 0) {
        // Find the best match (closest rating and longest wait time)
        const bestMatch = eligibleCandidates.reduce((best, current) => {
          const bestScore = calculateMatchScore(playerRating, best.rating, best.queue_time);
          const currentScore = calculateMatchScore(playerRating, current.rating, current.queue_time);
          return currentScore > bestScore ? current : best;
        });

        console.log(`✅ Found match: ${bestMatch.username} (rating: ${bestMatch.rating}, wait: ${bestMatch.queue_time}s)`);
        
        return {
          player1_id: playerId,
          player2_id: bestMatch.user_id,
          player1_rating: playerRating,
          player2_rating: bestMatch.rating,
          rating_difference: Math.abs(playerRating - bestMatch.rating),
        };
      }

      console.log(`Iteration ${iteration + 1}: No matches in rating range ±${ratingRange}`);
    }

    // If no match found with expanding range, try to match with anyone
    // who has been waiting long enough
    const longWaitCandidates = candidates.filter(c => 
      c.queue_time >= MATCHMAKING_CONFIG.MAX_QUEUE_TIME / 2
    );

    if (longWaitCandidates.length > 0) {
      const bestMatch = longWaitCandidates.reduce((best, current) => {
        const bestScore = calculateMatchScore(playerRating, best.rating, best.queue_time);
        const currentScore = calculateMatchScore(playerRating, current.rating, current.queue_time);
        return currentScore > bestScore ? current : best;
      });

      console.log(`⚠️ Forced match due to long wait: ${bestMatch.username}`);
      
      return {
        player1_id: playerId,
        player2_id: bestMatch.user_id,
        player1_rating: playerRating,
        player2_rating: bestMatch.rating,
        rating_difference: Math.abs(playerRating - bestMatch.rating),
      };
    }

    console.log('No suitable match found');
    return null;
  } catch (error) {
    console.error('Error in findMatch:', error);
    return null;
  }
}

/**
 * Calculate a score for how good a match is
 * Higher score = better match
 */
function calculateMatchScore(playerRating: number, opponentRating: number, queueTime: number): number {
  const ratingDifference = Math.abs(playerRating - opponentRating);
  const ratingScore = Math.max(0, 1000 - ratingDifference); // Closer ratings = higher score
  const timeScore = Math.min(queueTime * 10, 500); // Longer wait = higher score, capped at 500
  
  return ratingScore + timeScore;
}

/**
 * Create a new game between two players
 */
export async function createGame(match: MatchResult): Promise<Game | null> {
  try {
    console.log(`🎮 Creating game between ${match.player1_id} and ${match.player2_id}`);
    
    const { data: game, error } = await supabase
      .from('games')
      .insert({
        player1_id: match.player1_id,
        player2_id: match.player2_id,
        status: 'waiting',
        current_player: match.player1_id, // Player 1 goes first
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating game:', error);
      return null;
    }

    console.log(`✅ Game created: ${game.id}`);
    return game;
  } catch (error) {
    console.error('Error in createGame:', error);
    return null;
  }
}

/**
 * Remove players from queue after match creation
 */
export async function removePlayersFromQueue(playerIds: string[]): Promise<boolean> {
  try {
    console.log(`🗑️ Removing players from queue: ${playerIds.join(', ')}`);
    
    const { error } = await supabase
      .from('game_queue')
      .delete()
      .in('user_id', playerIds);

    if (error) {
      console.error('Error removing players from queue:', error);
      return false;
    }

    console.log('✅ Players removed from queue');
    return true;
  } catch (error) {
    console.error('Error in removePlayersFromQueue:', error);
    return false;
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
 * Process the entire queue to find matches
 */
export async function processQueue(): Promise<number> {
  try {
    console.log('🔄 Processing matchmaking queue...');
    
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
      return 0;
    }

    if (!queueEntries || queueEntries.length < 2) {
      console.log('Not enough players in queue for matching');
      return 0;
    }

    console.log(`Processing ${queueEntries.length} players in queue`);

    let matchesCreated = 0;
    const processedPlayers = new Set<string>();

    // Process each player in order of queue time
    for (const entry of queueEntries) {
      if (processedPlayers.has(entry.user_id)) {
        continue; // Already matched
      }

      const match = await findMatch(entry.user_id, entry.users.rating);
      
      if (match) {
        // Check if both players are still available
        if (processedPlayers.has(match.player1_id) || processedPlayers.has(match.player2_id)) {
          continue;
        }

        // Create the game
        const game = await createGame(match);
        
        if (game) {
          // Remove both players from queue
          await removePlayersFromQueue([match.player1_id, match.player2_id]);
          
          // Mark as processed
          processedPlayers.add(match.player1_id);
          processedPlayers.add(match.player2_id);
          
          matchesCreated++;
          console.log(`✅ Match ${matchesCreated} created: ${game.id}`);
        }
      }
    }

    console.log(`🎯 Queue processing complete: ${matchesCreated} matches created`);
    return matchesCreated;
  } catch (error) {
    console.error('Error in processQueue:', error);
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