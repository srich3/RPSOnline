import { useEffect, useRef, useCallback, useState } from 'react';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/auth/AuthProvider';
import { useGameStore } from '../store/gameStore';
import type { Game, GameQueue } from '../types/database';
import { 
  findMatch, 
  createGame as createMatchGame, 
  removePlayersFromQueue,
  processQueue,
  startQueueCleanup,
  stopQueueCleanup
} from '../utils/matchmaking';

interface MatchmakingState {
  isInQueue: boolean;
  queuePosition: number | null;
  estimatedWaitTime: number | null;
  matchFound: Game | null;
  error: string | null;
  loading: boolean;
}

interface UseMatchmakingOptions {
  autoAcceptMatch?: boolean;
  maxWaitTime?: number; // in seconds
  ratingRange?: number; // for skill-based matching
}

export const useMatchmaking = (options: UseMatchmakingOptions = {}) => {
  const {
    autoAcceptMatch = true,
    maxWaitTime = 60, // 1 minute
    ratingRange = 200, // ±200 rating points
  } = options;

  const { user, profile } = useAuth();
  const { startNewGame } = useGameStore();
  
  const [state, setState] = useState<MatchmakingState>({
    isInQueue: false,
    queuePosition: null,
    estimatedWaitTime: null,
    matchFound: null,
    error: null,
    loading: false,
  });

  // Refs for cleanup
  const queueSubscription = useRef<RealtimeChannel | null>(null);
  const matchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const waitTimeRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('🧹 Cleaning up matchmaking');
    
    if (queueSubscription.current) {
      queueSubscription.current.unsubscribe();
      queueSubscription.current = null;
    }
    
    if (matchTimeoutRef.current) {
      clearTimeout(matchTimeoutRef.current);
      matchTimeoutRef.current = null;
    }
    
    if (waitTimeRef.current) {
      clearTimeout(waitTimeRef.current);
      waitTimeRef.current = null;
    }
  }, []);

  // Join matchmaking queue
  const joinQueue = useCallback(async () => {
    if (!user?.id || state.isInQueue) return;

    console.log('🎯 Joining matchmaking queue');
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Check if already in queue
      const { data: existingQueue } = await supabase
        .from('game_queue')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (existingQueue) {
        console.log('⚠️ Already in queue');
        setState(prev => ({ 
          ...prev, 
          isInQueue: true, 
          loading: false,
          error: 'Already in queue'
        }));
        return;
      }

      // Join queue
      const { data: queueEntry, error } = await supabase
        .from('game_queue')
        .insert({
          user_id: user.id,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      console.log('✅ Joined queue:', queueEntry);
      setState(prev => ({ 
        ...prev, 
        isInQueue: true, 
        loading: false,
        queuePosition: 1, // Will be updated by subscription
      }));

      // Start wait time tracking
      let waitTime = 0;
      waitTimeRef.current = setInterval(() => {
        waitTime += 1;
        setState(prev => ({ 
          ...prev, 
          estimatedWaitTime: waitTime 
        }));
        
        // Auto-cancel if max wait time reached
        if (waitTime >= maxWaitTime) {
          console.log('⏰ Max wait time reached, leaving queue');
          leaveQueue();
        }
      }, 1000);

    } catch (error) {
      console.error('❌ Error joining queue:', error);
      setState(prev => ({ 
        ...prev, 
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to join queue'
      }));
    }
  }, [user?.id, state.isInQueue, maxWaitTime]);

  // Leave matchmaking queue
  const leaveQueue = useCallback(async () => {
    if (!user?.id || !state.isInQueue) return;

    console.log('🚪 Leaving matchmaking queue');
    setState(prev => ({ ...prev, loading: true }));

    try {
      const { error } = await supabase
        .from('game_queue')
        .delete()
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      console.log('✅ Left queue');
      setState(prev => ({ 
        ...prev, 
        isInQueue: false, 
        loading: false,
        queuePosition: null,
        estimatedWaitTime: null,
        error: null,
      }));

      // Clear timeouts
      if (waitTimeRef.current) {
        clearInterval(waitTimeRef.current);
        waitTimeRef.current = null;
      }

    } catch (error) {
      console.error('❌ Error leaving queue:', error);
      setState(prev => ({ 
        ...prev, 
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to leave queue'
      }));
    }
  }, [user?.id, state.isInQueue]);

  // Accept match
  const acceptMatch = useCallback(async (gameId: string) => {
    console.log('✅ Accepting match:', gameId);
    setState(prev => ({ ...prev, loading: true }));

    try {
      // Update game to mark player as ready
      const { error } = await supabase
        .from('games')
        .update({ 
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', gameId);

      if (error) {
        throw error;
      }

      // Start the game in the store
      if (state.matchFound) {
        startNewGame(
          state.matchFound.player1_id,
          state.matchFound.player2_id || ''
        );
      }

      // Clear matchmaking state
      setState(prev => ({ 
        ...prev, 
        isInQueue: false,
        matchFound: null,
        loading: false,
        queuePosition: null,
        estimatedWaitTime: null,
      }));

      // Leave queue
      await leaveQueue();

    } catch (error) {
      console.error('❌ Error accepting match:', error);
      setState(prev => ({ 
        ...prev, 
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to accept match'
      }));
    }
  }, [state.matchFound, startNewGame, leaveQueue]);

  // Decline match
  const declineMatch = useCallback(async (gameId: string) => {
    console.log('❌ Declining match:', gameId);
    setState(prev => ({ ...prev, loading: true }));

    try {
      // Delete the game
      const { error } = await supabase
        .from('games')
        .delete()
        .eq('id', gameId);

      if (error) {
        throw error;
      }

      // Clear match state and rejoin queue
      setState(prev => ({ 
        ...prev, 
        matchFound: null,
        loading: false,
      }));

      // Rejoin queue after a short delay
      setTimeout(() => {
        joinQueue();
      }, 2000);

    } catch (error) {
      console.error('❌ Error declining match:', error);
      setState(prev => ({ 
        ...prev, 
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to decline match'
      }));
    }
  }, [joinQueue]);

  // Find suitable opponent using new matchmaking utilities
  const findOpponent = useCallback(async (): Promise<string | null> => {
    if (!user?.id || !profile) return null;

    console.log('🔍 Finding opponent for player:', user.id);

    try {
      const match = await findMatch(user.id, profile.rating || 100);
      
      if (match) {
        console.log('🎯 Match found:', match);
        return match.player2_id;
      }

      console.log('👥 No suitable opponents found');
      return null;

    } catch (error) {
      console.error('❌ Error finding opponent:', error);
      return null;
    }
  }, [user?.id, profile]);

  // Create game with opponent using new matchmaking utilities
  const createGame = useCallback(async (opponentId: string): Promise<Game | null> => {
    if (!user?.id) return null;

    console.log('🎮 Creating game with opponent:', opponentId);

    try {
      const match = {
        player1_id: user.id,
        player2_id: opponentId,
        player1_rating: profile?.rating || 100,
        player2_rating: 100, // Will be updated when we get opponent profile
        rating_difference: 0,
      };

      const game = await createMatchGame(match);
      
      if (game) {
        // Remove both players from queue
        await removePlayersFromQueue([user.id, opponentId]);
        console.log('✅ Game created and players removed from queue:', game);
      }

      return game;

    } catch (error) {
      console.error('❌ Error creating game:', error);
      return null;
    }
  }, [user?.id, profile]);

  // Handle queue changes
  const handleQueueChange = useCallback((payload: RealtimePostgresChangesPayload<GameQueue>) => {
    console.log('📋 Queue change:', payload);
    
    const { new: newEntry, old: oldEntry, eventType } = payload;
    
    switch (eventType) {
      case 'INSERT':
        // New player joined queue
        if (newEntry.user_id !== user?.id) {
          console.log('👤 New player joined queue:', newEntry);
          
          // Try to find a match
          findOpponent().then(async (opponentId) => {
            if (opponentId) {
              const game = await createGame(opponentId);
              if (game) {
                console.log('🎮 Match found! Game created:', game);
                setState(prev => ({ 
                  ...prev, 
                  matchFound: game,
                  isInQueue: false,
                }));
                
                // Auto-accept if enabled
                if (autoAcceptMatch) {
                  setTimeout(() => {
                    acceptMatch(game.id);
                  }, 1000);
                }
              }
            }
          });
        }
        break;
        
      case 'DELETE':
        // Player left queue
        if (oldEntry.user_id !== user?.id) {
          console.log('👋 Player left queue:', oldEntry);
        } else {
          // We left the queue
          console.log('🚪 We left the queue');
          setState(prev => ({ 
            ...prev, 
            isInQueue: false,
            queuePosition: null,
            estimatedWaitTime: null,
          }));
        }
        break;
    }
  }, [user?.id, findOpponent, createGame, autoAcceptMatch, acceptMatch]);

  // Handle game changes (for match acceptance)
  const handleGameChange = useCallback((payload: RealtimePostgresChangesPayload<Game>) => {
    console.log('🎮 Game change in matchmaking:', payload);
    
    const { new: newGame, eventType } = payload;
    
    if (eventType === 'UPDATE' && newGame) {
      // Check if this is our match and it was accepted
      if (state.matchFound && 
          newGame.id === state.matchFound.id && 
          newGame.status === 'active') {
        console.log('✅ Match accepted by opponent');
        
        // Start the game
        startNewGame(newGame.player1_id, newGame.player2_id || '');
        
        // Clear matchmaking state
        setState(prev => ({ 
          ...prev, 
          isInQueue: false,
          matchFound: null,
          queuePosition: null,
          estimatedWaitTime: null,
        }));
        
        // Leave queue
        leaveQueue();
      }
    }
  }, [state.matchFound, startNewGame, leaveQueue]);

  // Setup queue subscription
  const setupQueueSubscription = useCallback(async () => {
    if (!user?.id) return;

    console.log('📋 Setting up queue subscription');
    
    try {
      const channel = supabase
        .channel(`matchmaking:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'game_queue',
          },
          handleQueueChange
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'games',
            filter: `player1_id=eq.${user.id} OR player2_id=eq.${user.id}`,
          },
          handleGameChange
        )
        .subscribe();

      queueSubscription.current = channel;

    } catch (error) {
      console.error('❌ Error setting up queue subscription:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to setup queue subscription'
      }));
    }
  }, [user?.id, handleQueueChange, handleGameChange]);

  // Setup subscription on mount
  useEffect(() => {
    if (!user?.id) return;

    setupQueueSubscription();
    
    // Start queue cleanup
    startQueueCleanup();

    return () => {
      cleanup();
      stopQueueCleanup();
    };
  }, [user?.id, setupQueueSubscription, cleanup]);

  // Auto-accept match with timeout
  useEffect(() => {
    if (state.matchFound && autoAcceptMatch) {
      console.log('⏰ Auto-accepting match in 10 seconds');
      
      matchTimeoutRef.current = setTimeout(() => {
        if (state.matchFound) {
          acceptMatch(state.matchFound.id);
        }
      }, 10000); // 10 second timeout

      return () => {
        if (matchTimeoutRef.current) {
          clearTimeout(matchTimeoutRef.current);
          matchTimeoutRef.current = null;
        }
      };
    }
  }, [state.matchFound, autoAcceptMatch, acceptMatch]);

  return {
    // State
    isInQueue: state.isInQueue,
    queuePosition: state.queuePosition,
    estimatedWaitTime: state.estimatedWaitTime,
    matchFound: state.matchFound,
    error: state.error,
    loading: state.loading,
    
    // Actions
    joinQueue,
    leaveQueue,
    acceptMatch,
    declineMatch,
    
    // Utilities
    findOpponent,
    createGame,
  };
}; 