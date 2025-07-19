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

      // Join the matchmaking queue using the new real-time approach
      const success = await joinMatchmakingQueue(
        user.id,
        profile.username,
        profile.rating
      );

      if (success) {
        console.log('✅ Joined matchmaking queue');
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
  }, [user?.id, profile, state.isInQueue, maxWaitTime]);

  // Leave matchmaking queue
  const leaveQueue = useCallback(async () => {
    if (!user?.id || !state.isInQueue) return;

    console.log('🚪 Leaving matchmaking queue');
    setState(prev => ({ ...prev, loading: true }));

    try {
      const success = await leaveMatchmakingQueue(user.id);

      if (success) {
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
  }, [user?.id, state.isInQueue]);

  // Accept match
  const acceptMatch = useCallback(async (gameId: string) => {
    if (!user?.id) return;

    console.log('✅ Accepting match:', gameId);
    setState(prev => ({ ...prev, loading: true }));

    try {
      const success = await acceptMatchUtil(gameId, user.id);

      if (success) {
        console.log('✅ Match accepted');
        
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
  }, [user?.id, state.matchFound, startNewGame, leaveQueue]);

  // Decline match
  const declineMatch = useCallback(async (gameId: string) => {
    if (!user?.id) return;

    console.log('❌ Declining match:', gameId);
    setState(prev => ({ ...prev, loading: true }));

    try {
      const success = await declineMatchUtil(gameId, user.id);

      if (success) {
        console.log('❌ Match declined');
        
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
  }, [user?.id, joinQueue]);

  // Setup matchmaking subscription
  const setupMatchmakingSubscription = useCallback(() => {
    if (!user?.id) return;

    console.log('📡 Setting up matchmaking subscription');

    matchmakingSubscription.current = subscribeToMatchmaking(
      user.id,
      // onMatchFound
      (message) => {
        console.log('🎯 Match found:', message);
        
        // Get the game details
        supabase
          .from('games')
          .select('*')
          .eq('id', message.game_id)
          .single()
          .then(({ data: game, error }) => {
            if (error) {
              console.error('Error fetching game:', error);
              return;
            }
            
            if (game) {
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
          });
      },
      // onMatchAccepted
      (message) => {
        console.log('✅ Match accepted by opponent:', message);
        
        // Start the game
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
          queuePosition: null,
          estimatedWaitTime: null,
        }));
        
        // Leave queue
        leaveQueue();
      },
      // onMatchDeclined
      (message) => {
        console.log('❌ Match declined by opponent:', message);
        
        // Clear match state and rejoin queue
        setState(prev => ({ 
          ...prev, 
          matchFound: null,
        }));
        
        // Rejoin queue after a short delay
        setTimeout(() => {
          joinQueue();
        }, 2000);
      }
    );
  }, [user?.id, autoAcceptMatch, acceptMatch, startNewGame, leaveQueue, joinQueue]);

  // Setup subscription on mount
  useEffect(() => {
    if (!user?.id) return;

    setupMatchmakingSubscription();
    
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
  }, [user?.id, setupMatchmakingSubscription]);

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