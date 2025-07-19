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
        .single();

      if (error || !queueEntry) {
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
  }, [user?.id, profile, state.isInQueue, maxWaitTime, saveQueueState]);

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
        console.log('✅ Match accepted');
        
        // Clear queue state from localStorage
        clearQueueState();
        
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
  }, [user?.id, state.matchFound, startNewGame, leaveQueue, clearQueueState]);

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

    // Listen for new games (matches) created for this user
    const channel = supabase
      .channel(`matchmaking:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'games',
          filter: `player1_id=eq.${user.id} OR player2_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('🎯 New game created (match found):', payload);
          const game = payload.new as Game;
          
          if (game.status === 'waiting') {
            console.log('🎮 Match found! Starting game...');
            
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
            }));
            
            // Auto-accept if enabled
            if (autoAcceptMatch) {
              setTimeout(() => {
                acceptMatch(game.id);
              }, 1000);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `player1_id=eq.${user.id} OR player2_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('🔄 Game updated:', payload);
          const game = payload.new as Game;
          
          if (game.status === 'active' && state.matchFound?.id === game.id) {
            console.log('✅ Match accepted by opponent');
            
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
            }));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'games',
          filter: `player1_id=eq.${user.id} OR player2_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('❌ Game deleted (match declined):', payload);
          
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
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'game_queue',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('🚪 Removed from queue (likely match found):', payload);
          
          // If we're still showing as in queue, clear the state
          if (state.isInQueue) {
            console.log('🎯 Match found! Clearing queue state...');
            
            // Clear queue state from localStorage
            clearQueueState();
            
            // Stop wait time tracking
            if (waitTimeRef.current) {
              clearInterval(waitTimeRef.current);
              waitTimeRef.current = null;
            }
            
            setState(prev => ({ 
              ...prev, 
              isInQueue: false,
              queuePosition: null,
              estimatedWaitTime: null,
            }));
          }
        }
      )
      .subscribe();

    matchmakingSubscription.current = channel;
  }, [user?.id, autoAcceptMatch, acceptMatch, startNewGame, joinQueue, clearQueueState, state.matchFound, state.isInQueue]);

  // Setup subscription and restore state on mount
  useEffect(() => {
    if (!user?.id) return;

    // Restore queue state first
    restoreQueueState().then(() => {
      // Then setup subscription
      setupMatchmakingSubscription();
    });
    
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