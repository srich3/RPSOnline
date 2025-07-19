import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { useGameStore } from '../store/gameStore';
import type { Game } from '../types/database';
import { 
  joinMatchmakingQueue,
  leaveMatchmakingQueue,
  subscribeToMatchmaking,
  acceptMatch as acceptMatchUtil,
  declineMatch as declineMatchUtil,
  startQueueCleanup,
  stopQueueCleanup,
  type DeclineMessage
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

// localStorage keys
const QUEUE_STORAGE_KEY = 'tacto-matchmaking-queue';
const QUEUE_TIMESTAMP_KEY = 'tacto-matchmaking-timestamp';

// Queue state interface for localStorage
interface QueueStorageState {
  userId: string;
  username: string;
  rating: number;
  joinedAt: number;
  estimatedWaitTime: number;
}

export const useMatchmaking = (options: UseMatchmakingOptions = {}) => {
  const { user, profile } = useAuth();
  const { startNewGame } = useGameStore();
  
  const {
    autoAcceptMatch = false,
    maxWaitTime = 300, // 5 minutes default
    ratingRange = 300,
  } = options;

  const [state, setState] = useState<MatchmakingState>({
    isInQueue: false,
    queuePosition: null,
    estimatedWaitTime: null,
    matchFound: null,
    error: null,
    loading: false,
  });

  const waitTimeRef = useRef<NodeJS.Timeout | null>(null);
  const matchmakingSubscription = useRef<any>(null);
  const matchFoundRef = useRef<Game | null>(null);
  const isInQueueRef = useRef<boolean>(false);
  const subscriptionSetupRef = useRef<boolean>(false);

  // Save queue state to localStorage
  const saveQueueState = useCallback((queueState: QueueStorageState) => {
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queueState));
      localStorage.setItem(QUEUE_TIMESTAMP_KEY, Date.now().toString());
      console.log('💾 Queue state saved to localStorage:', queueState);
    } catch (error) {
      console.error('Error saving queue state to localStorage:', error);
    }
  }, []);

  // Load queue state from localStorage
  const loadQueueState = useCallback((): QueueStorageState | null => {
    try {
      const queueData = localStorage.getItem(QUEUE_STORAGE_KEY);
      const timestamp = localStorage.getItem(QUEUE_TIMESTAMP_KEY);
      
      if (!queueData || !timestamp) {
        return null;
      }

      const queueState: QueueStorageState = JSON.parse(queueData);
      const savedTime = parseInt(timestamp, 10);
      const now = Date.now();
      
      // Check if the saved state is too old (more than 1 hour)
      if (now - savedTime > 60 * 60 * 1000) {
        console.log('🧹 Clearing old queue state from localStorage');
        clearQueueState();
        return null;
      }

      console.log('📂 Queue state loaded from localStorage:', queueState);
      return queueState;
    } catch (error) {
      console.error('Error loading queue state from localStorage:', error);
      return null;
    }
  }, []);

  // Clear queue state from localStorage
  const clearQueueState = useCallback(() => {
    try {
      localStorage.removeItem(QUEUE_STORAGE_KEY);
      localStorage.removeItem(QUEUE_TIMESTAMP_KEY);
      console.log('🗑️ Queue state cleared from localStorage');
    } catch (error) {
      console.error('Error clearing queue state from localStorage:', error);
    }
  }, []);

  // Restore queue state on page load
  const restoreQueueState = useCallback(async () => {
    if (!user?.id || !profile) return;

    const savedState = loadQueueState();
    if (!savedState || savedState.userId !== user.id) {
      return;
    }

    console.log('🔄 Restoring queue state for user:', user.id);
    setState(prev => ({ ...prev, loading: true }));

    try {
      // Check if user is still in the database queue
      const { data: queueEntry, error } = await supabase
        .from('game_queue')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        // If it's a 406 error, it might mean the user was matched and removed
        // Check if there's a recent game for this user instead
        if (error.code === '406' || error.code === 'PGRST116') {
          console.log('🔍 User not in queue, checking for recent games...');
          
          const { data: recentGame, error: gameError } = await supabase
            .from('games')
            .select('*')
            .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
            .eq('status', 'waiting')
            .order('created_at', { ascending: false })
            .limit(1);

          if (recentGame && recentGame.length > 0 && !gameError) {
            console.log('🎯 Found recent game, user was matched!');
            setState(prev => ({ 
              ...prev, 
              matchFound: recentGame[0],
              isInQueue: false,
              loading: false,
              error: null,
            }));
            return;
          }
        }
        
        console.log('⚠️ User not found in database queue, clearing localStorage');
        clearQueueState();
        setState(prev => ({ ...prev, loading: false }));
        return;
      }

      if (!queueEntry) {
        console.log('⚠️ User not found in database queue, clearing localStorage');
        clearQueueState();
        setState(prev => ({ ...prev, loading: false }));
        return;
      }

      // Restore the queue state
      const waitTime = Math.floor((Date.now() - savedState.joinedAt) / 1000);
      
              setState(prev => ({
          ...prev,
          isInQueue: true,
          queuePosition: 1,
          estimatedWaitTime: waitTime,
          loading: false,
          error: null,
        }));

      console.log('✅ Queue state restored successfully');

      // Restart wait time tracking
      if (waitTimeRef.current) {
        clearInterval(waitTimeRef.current);
      }

      waitTimeRef.current = setInterval(() => {
        setState(prev => {
          const newWaitTime = (prev.estimatedWaitTime || 0) + 1;
          
          // Auto-cancel if max wait time reached
          if (newWaitTime >= maxWaitTime) {
            console.log('⏰ Max wait time reached, leaving queue');
            leaveQueue();
            return prev;
          }
          
          return { ...prev, estimatedWaitTime: newWaitTime };
        });
      }, 1000);

    } catch (error) {
      console.error('❌ Error restoring queue state:', error);
      clearQueueState();
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [user?.id, profile, loadQueueState, clearQueueState, maxWaitTime]);

  // Join matchmaking queue
  const joinQueue = useCallback(async () => {
    if (!user?.id || !profile || state.isInQueue) return;

    console.log('🎯 Joining matchmaking queue for user:', user.id);
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Check authentication status
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }
      console.log('✅ User authenticated, session valid');

      // First, check if user already has an existing game
      const { data: existingGames, error: gameError } = await supabase
        .from('games')
        .select('*')
        .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
        .in('status', ['waiting', 'active'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (gameError) {
        console.error('Error checking existing games:', gameError);
      } else if (existingGames && existingGames.length > 0) {
        const existingGame = existingGames[0];
        console.log('🎮 Found existing game:', existingGame);
        
        if (existingGame.status === 'waiting') {
          // Show match found modal for existing waiting game
          console.log('🎯 Showing existing match for acceptance');
          setState(prev => ({ 
            ...prev, 
            matchFound: existingGame,
            isInQueue: false,
            loading: false,
            queuePosition: null,
            estimatedWaitTime: null,
            error: null,
          }));
          return;
        } else if (existingGame.status === 'active') {
          // Game is already active, start it immediately
          console.log('🎮 Starting existing active game');
          startNewGame(
            existingGame.player1_id,
            existingGame.player2_id || ''
          );
          setState(prev => ({ 
            ...prev, 
            loading: false,
            isInQueue: false,
            matchFound: null,
            queuePosition: null,
            estimatedWaitTime: null,
            error: null,
          }));
          return;
        }
      }

      // No existing game found, proceed with joining queue
      console.log('📋 No existing game found, joining queue...');

      // Join the matchmaking queue using the new real-time approach
      const success = await joinMatchmakingQueue(
        user.id,
        profile.username,
        profile.rating
      );

      if (success) {
        console.log('✅ Joined matchmaking queue');
        
        // Save queue state to localStorage
        const queueState: QueueStorageState = {
          userId: user.id,
          username: profile.username,
          rating: profile.rating,
          joinedAt: Date.now(),
          estimatedWaitTime: 0,
        };
        saveQueueState(queueState);

        setState(prev => ({ 
          ...prev, 
          isInQueue: true, 
          loading: false,
          queuePosition: 1,
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
      } else {
        throw new Error('Failed to join matchmaking queue');
      }

    } catch (error) {
      console.error('❌ Error joining queue:', error);
      setState(prev => ({ 
        ...prev, 
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to join queue'
      }));
    }
  }, [user?.id, profile, state.isInQueue, maxWaitTime, saveQueueState, startNewGame]);

  // Leave matchmaking queue
  const leaveQueue = useCallback(async () => {
    if (!user?.id || !state.isInQueue) return;

    console.log('🚪 Leaving matchmaking queue');
    setState(prev => ({ ...prev, loading: true }));

    try {
      const success = await leaveMatchmakingQueue(user.id);

      if (success) {
        console.log('✅ Left queue');
        
        // Clear queue state from localStorage
        clearQueueState();
        
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
      } else {
        throw new Error('Failed to leave matchmaking queue');
      }

    } catch (error) {
      console.error('❌ Error leaving queue:', error);
      setState(prev => ({ 
        ...prev, 
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to leave queue'
      }));
    }
  }, [user?.id, state.isInQueue, clearQueueState]);

  // Accept match
  const acceptMatch = useCallback(async (gameId: string) => {
    if (!user?.id) return;

    console.log('✅ Accepting match:', gameId);
    setState(prev => ({ ...prev, loading: true }));

    try {
      const success = await acceptMatchUtil(gameId, user.id);

      if (success) {
        console.log('✅ Match acceptance recorded, waiting for other player...');
        
        // Don't start the game yet - wait for database notification
        // Just show that we've accepted
        setState(prev => ({ 
          ...prev, 
          loading: false,
          error: null,
        }));
      } else {
        throw new Error('Failed to accept match');
      }

    } catch (error) {
      console.error('❌ Error accepting match:', error);
      setState(prev => ({ 
        ...prev, 
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to accept match'
      }));
    }
  }, [user?.id]);

  // Decline match
  const declineMatch = useCallback(async (gameId: string) => {
    if (!user?.id) return;

    console.log('❌ Declining match:', gameId);
    setState(prev => ({ ...prev, loading: true }));

    try {
      const success = await declineMatchUtil(gameId, user.id);

      if (success) {
        console.log('❌ Match declined');
        
        // Clear match state and queue state
        clearQueueState();
        setState(prev => ({ 
          ...prev, 
          matchFound: null,
          isInQueue: false,
          queuePosition: null,
          estimatedWaitTime: null,
          loading: false,
          error: null,
        }));

        // Update refs
        matchFoundRef.current = null;
        isInQueueRef.current = false;

        // Don't rejoin queue - the declining player should stay out
        // The other player will be notified and can rejoin if they want
      } else {
        throw new Error('Failed to decline match');
      }

    } catch (error) {
      console.error('❌ Error declining match:', error);
      setState(prev => ({ 
        ...prev, 
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to decline match'
      }));
    }
  }, [user?.id, clearQueueState]);



  // Setup matchmaking subscription
  const setupMatchmakingSubscription = useCallback(async () => {
    if (!user?.id) return;

    // Prevent duplicate subscription setup
    if (subscriptionSetupRef.current) {
      console.log('📡 Subscription already being set up, skipping...');
      return;
    }

    subscriptionSetupRef.current = true;
    console.log('📡 Setting up matchmaking subscription for user:', user.id);

    // Check if user already has a recent game (in case they were matched before subscription)
    try {
      const { data: recentGame, error: gameError } = await supabase
        .from('games')
        .select('*')
        .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
        .eq('status', 'waiting')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentGame && !gameError) {
        console.log('🎯 Found existing game, user was already matched!');
        setState(prev => ({ 
          ...prev, 
          matchFound: recentGame,
          isInQueue: false,
          loading: false,
          error: null,
        }));
        subscriptionSetupRef.current = false; // Reset flag
        return; // Don't set up subscription if we already have a game
      }
    } catch (error) {
      console.log('📡 No recent games found, setting up subscription...');
    }

    // Clean up any existing subscription
    if (matchmakingSubscription.current) {
      console.log('🧹 Cleaning up existing subscription');
      matchmakingSubscription.current.unsubscribe();
      matchmakingSubscription.current = null;
    }

    // Create a simple, focused subscription
    const channel = supabase
      .channel(`matchmaking-${user.id}`)
      
      // Debug: Listen to ALL events on games table
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games',
        },
        (payload) => {
          console.log('🔍 ALL games event:', payload.eventType, payload);
        }
      )
      
      // Test: Listen to ALL events on ANY table
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
        },
        (payload) => {
          console.log('🔍 ANY table event:', payload.eventType, payload.table, payload);
        }
      )
      
      // Test: Listen to broadcast events
      .on(
        'broadcast',
        { event: 'test' },
        (payload) => {
          console.log('🔍 Broadcast test event:', payload);
        }
      )
      
      // Primary: Listen for new games (matches) created for this user
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'games',
        },
        (payload) => {
          console.log('🎯 New game created:', payload);
          const game = payload.new as Game;
          console.log('🎯 Game details:', { 
            id: game.id, 
            player1_id: game.player1_id, 
            player2_id: game.player2_id, 
            status: game.status,
            our_id: user.id 
          });
          
          // Check if this game is for us
          if ((game.player1_id === user.id || game.player2_id === user.id) && game.status === 'waiting') {
            console.log('🎮 Match found for us! Starting game...');
            
            // Clear queue state from localStorage
            clearQueueState();
            
            // Stop wait time tracking
            if (waitTimeRef.current) {
              clearInterval(waitTimeRef.current);
              waitTimeRef.current = null;
            }
            
            setState(prev => ({ 
              ...prev, 
              matchFound: game,
              isInQueue: false,
              queuePosition: null,
              estimatedWaitTime: null,
              loading: false,
              error: null,
            }));
            
            // Update refs
            matchFoundRef.current = game;
            isInQueueRef.current = false;
            
            // Auto-accept if enabled
            if (autoAcceptMatch) {
              setTimeout(() => {
                acceptMatch(game.id);
              }, 1000);
            }
          } else {
            console.log('🎯 Game not for us or not waiting status');
          }
        }
      )
      
      // Listen for game updates (acceptance)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
        },
        (payload) => {
          console.log('🔄 Game updated:', payload);
          const game = payload.new as Game;
          
          // Check if this game is for us
          if (game.player1_id === user.id || game.player2_id === user.id) {
            // Check if this is our current match and both players have accepted
            if (matchFoundRef.current?.id === game.id && 
                game.status === 'active' && 
                game.player1_accepted && 
                game.player2_accepted) {
              console.log('✅ Both players accepted, starting game!');
              
              // Clear queue state from localStorage
              clearQueueState();
              
              // Start the game
              startNewGame(
                game.player1_id,
                game.player2_id || ''
              );
              
              // Clear matchmaking state
              setState(prev => ({ 
                ...prev, 
                isInQueue: false,
                matchFound: null,
                queuePosition: null,
                estimatedWaitTime: null,
                loading: false,
                error: null,
              }));
              
              // Update refs
              matchFoundRef.current = null;
              isInQueueRef.current = false;
            } else if (matchFoundRef.current?.id === game.id) {
              // Update the match found state with latest acceptance info
              console.log('🔄 Match acceptance updated:', game);
              setState(prev => ({ 
                ...prev, 
                matchFound: game,
              }));
              matchFoundRef.current = game;
            }
          }
        }
      )
      
      // Listen for game deletions (declines)
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'games',
        },
        (payload) => {
          console.log('❌ Game deleted:', payload);
          const game = payload.old as Game;
          
          // Check if this game was for us
          if (game.player1_id === user.id || game.player2_id === user.id) {
            console.log('❌ Our game was deleted (match declined)');
            
            // Clear match state and queue state
            clearQueueState();
            setState(prev => ({ 
              ...prev, 
              matchFound: null,
              isInQueue: false,
              queuePosition: null,
              estimatedWaitTime: null,
              loading: false,
              error: null,
            }));
            
            // Update refs
            matchFoundRef.current = null;
            isInQueueRef.current = false;
            
            // Show notification that other player declined
            setState(prev => ({ 
              ...prev, 
              error: 'The other player declined the match. Rejoining queue...',
            }));
            
            // Rejoin queue after a short delay for the non-declining player
            setTimeout(() => {
              joinQueue();
            }, 3000);
          }
        }
      )
      
      .subscribe((status) => {
        console.log('📡 Matchmaking subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Matchmaking subscription active');
          subscriptionSetupRef.current = false; // Reset flag on success
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Matchmaking subscription error - will retry in 5s');
          subscriptionSetupRef.current = false; // Reset flag on error
          // Retry subscription after a delay
          setTimeout(() => {
            if (user?.id) {
              console.log('🔄 Retrying matchmaking subscription...');
              setupMatchmakingSubscription();
            }
          }, 5000);
        } else if (status === 'TIMED_OUT') {
          console.warn('⏰ Matchmaking subscription timed out - will retry in 2s');
          subscriptionSetupRef.current = false; // Reset flag on timeout
          // Retry subscription after a delay
          setTimeout(() => {
            if (user?.id) {
              console.log('🔄 Retrying matchmaking subscription...');
              setupMatchmakingSubscription();
            }
          }, 2000);
        }
      });

    matchmakingSubscription.current = channel;
  }, [user?.id, autoAcceptMatch, acceptMatch, startNewGame, joinQueue, clearQueueState]);

  // Keep refs in sync with state
  useEffect(() => {
    matchFoundRef.current = state.matchFound;
  }, [state.matchFound]);

  useEffect(() => {
    isInQueueRef.current = state.isInQueue;
  }, [state.isInQueue]);

      // Setup subscription and restore state on mount
  useEffect(() => {
    if (!user?.id) return;

    // Restore queue state first, then setup subscription
    const initializeMatchmaking = async () => {
      await restoreQueueState();
      
      // Only setup subscription if we don't already have a match
      if (!state.matchFound) {
        await setupMatchmakingSubscription();
      }
    };

    initializeMatchmaking();
    
    // Start queue cleanup
    startQueueCleanup();

    return () => {
      // Cleanup subscription
      if (matchmakingSubscription.current) {
        matchmakingSubscription.current.unsubscribe();
      }
      
      // Clear timeouts
      if (waitTimeRef.current) {
        clearInterval(waitTimeRef.current);
      }
      
      // Stop queue cleanup
      stopQueueCleanup();
    };
  }, [user?.id, restoreQueueState, setupMatchmakingSubscription]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (matchmakingSubscription.current) {
      matchmakingSubscription.current.unsubscribe();
      matchmakingSubscription.current = null;
    }
    
    if (waitTimeRef.current) {
      clearInterval(waitTimeRef.current);
      waitTimeRef.current = null;
    }
  }, []);

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
    cleanup,
  };
}; 