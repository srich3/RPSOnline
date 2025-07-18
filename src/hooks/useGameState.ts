import { useEffect, useRef, useCallback, useState } from 'react';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useGameStore } from '../store/gameStore';
import { useAuth } from '../components/auth/AuthProvider';
import type { Game, GameMove } from '../types/database';
import type { GameState, GameBoardState, PlayerTurn } from '../types/game';

interface UseGameStateOptions {
  gameId?: string;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

interface GameStateSubscription {
  game: RealtimeChannel | null;
  moves: RealtimeChannel | null;
  queue: RealtimeChannel | null;
}

interface ConnectionState {
  isConnected: boolean;
  isReconnecting: boolean;
  lastConnected: Date | null;
  reconnectAttempts: number;
  error: string | null;
}

export const useGameState = (options: UseGameStateOptions = {}) => {
  const {
    gameId,
    autoReconnect = true,
    reconnectInterval = 5000,
    maxReconnectAttempts = 5,
  } = options;

  const { user } = useAuth();
  const {
    currentGame,
    boardState,
    gameStatus,
    winner,
    currentTurn,
    timeRemaining,
    isMyTurn,
    pendingActions,
    gameHistory,
    startNewGame,
    makeMove,
    submitTurn,
    endTurn,
    updateTimeRemaining,
    resetGame,
    resolveTurn,
  } = useGameStore();

  // Subscription management
  const subscriptions = useRef<GameStateSubscription>({
    game: null,
    moves: null,
    queue: null,
  });

  // Connection state
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    isReconnecting: false,
    lastConnected: null,
    reconnectAttempts: 0,
    error: null,
  });

  // Reconnection management
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  // Cleanup function for subscriptions
  const cleanupSubscriptions = useCallback(() => {
    console.log('🧹 Cleaning up subscriptions');
    
    if (subscriptions.current.game && typeof subscriptions.current.game.unsubscribe === 'function') {
      try {
        subscriptions.current.game.unsubscribe();
      } catch (error) {
        console.error('❌ Error unsubscribing from game channel:', error);
      }
      subscriptions.current.game = null;
    }
    
    if (subscriptions.current.moves && typeof subscriptions.current.moves.unsubscribe === 'function') {
      try {
        subscriptions.current.moves.unsubscribe();
      } catch (error) {
        console.error('❌ Error unsubscribing from moves channel:', error);
      }
      subscriptions.current.moves = null;
    }
    
    if (subscriptions.current.queue && typeof subscriptions.current.queue.unsubscribe === 'function') {
      try {
        subscriptions.current.queue.unsubscribe();
      } catch (error) {
        console.error('❌ Error unsubscribing from queue channel:', error);
      }
      subscriptions.current.queue = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  // Handle game state changes
  const handleGameChange = useCallback((payload: RealtimePostgresChangesPayload<Game>) => {
    console.log('🎮 Game state change:', payload);
    
    const { new: newGame, old: oldGame, eventType } = payload;
    
    if (!newGame) return;

    switch (eventType) {
      case 'INSERT':
        // New game created
        console.log('🆕 New game created:', newGame);
        break;
        
      case 'UPDATE':
        // Game state updated
        console.log('🔄 Game updated:', newGame);
        
        // Update game state in store
        if (newGame.game_state) {
          try {
            const gameState = newGame.game_state as unknown as GameBoardState;
            
            // Update current turn if it changed
            if (gameState.current_turn && 
                (!currentTurn || currentTurn.player_id !== gameState.current_turn.player_id)) {
              console.log('👤 Turn changed to:', gameState.current_turn.player_id);
            }
            
            // Check if game ended
            if (newGame.status === 'finished' && newGame.winner_id) {
              console.log('🏆 Game finished, winner:', newGame.winner_id);
            }
            
          } catch (error) {
            console.error('❌ Error parsing game state:', error);
          }
        }
        break;
        
      case 'DELETE':
        // Game deleted
        console.log('🗑️ Game deleted:', oldGame);
        resetGame();
        break;
    }
  }, [currentTurn, resetGame]);

  // Handle game moves changes
  const handleMovesChange = useCallback((payload: RealtimePostgresChangesPayload<GameMove>) => {
    console.log('🎯 Game move change:', payload);
    
    const { new: newMove, old: oldMove, eventType } = payload;
    
    if (!newMove) return;

    switch (eventType) {
      case 'INSERT':
        // New move made
        console.log('➕ New move:', newMove);
        
        // Add to game history
        // Note: This should be handled by the game store
        break;
        
      case 'UPDATE':
        // Move updated (rare, but possible for corrections)
        console.log('✏️ Move updated:', newMove);
        break;
        
      case 'DELETE':
        // Move deleted (rare, but possible for corrections)
        console.log('🗑️ Move deleted:', oldMove);
        break;
    }
  }, []);

  // Handle queue changes
  const handleQueueChange = useCallback((payload: RealtimePostgresChangesPayload<any>) => {
    console.log('📋 Queue change:', payload);
    
    const { new: newEntry, old: oldEntry, eventType } = payload;
    
    switch (eventType) {
      case 'INSERT':
        // New player joined queue
        console.log('👤 Player joined queue:', newEntry);
        break;
        
      case 'DELETE':
        // Player left queue (matched or cancelled)
        console.log('👋 Player left queue:', oldEntry);
        break;
    }
  }, []);

  // Handle connection state changes
  const handleConnectionChange = useCallback((status: string, channel: RealtimeChannel) => {
    console.log(`🔌 Connection status changed: ${status} for channel:`, channel.topic);
    
    switch (status) {
      case 'SUBSCRIBED':
        setConnectionState(prev => ({
          ...prev,
          isConnected: true,
          isReconnecting: false,
          lastConnected: new Date(),
          reconnectAttempts: 0,
          error: null,
        }));
        reconnectAttemptsRef.current = 0;
        break;
        
      case 'CHANNEL_ERROR':
        setConnectionState(prev => ({
          ...prev,
          isConnected: false,
          error: 'Channel error occurred',
        }));
        break;
        
      case 'TIMED_OUT':
        setConnectionState(prev => ({
          ...prev,
          isConnected: false,
          error: 'Connection timed out',
        }));
        break;
        
      case 'CLOSED':
        setConnectionState(prev => ({
          ...prev,
          isConnected: false,
        }));
        break;
    }
  }, []);

  // Setup game subscription
  const setupGameSubscription = useCallback(async () => {
    if (!gameId) return;

    console.log('🎮 Setting up game subscription for:', gameId);
    
    try {
      // Subscribe to game changes
      const gameChannel = supabase
        .channel(`game:${gameId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'games',
            filter: `id=eq.${gameId}`,
          },
          handleGameChange
        )
        .on('presence', { event: 'sync' }, () => {
          console.log('👥 Presence sync');
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          console.log('👋 Player joined:', key, newPresences);
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          console.log('👋 Player left:', key, leftPresences);
        })
        .on('broadcast', { event: 'player_action' }, (payload) => {
          console.log('📡 Player action broadcast:', payload);
          // Handle real-time player actions (like opponent's pending actions)
        })
        .on('broadcast', { event: 'turn_submitted' }, (payload) => {
          console.log('📡 Turn submitted broadcast:', payload);
          // Handle turn submission notifications
        })
        .subscribe((status) => {
          handleConnectionChange(status, gameChannel);
        });

      subscriptions.current.game = gameChannel;

      // Subscribe to game moves
      const movesChannel = supabase
        .channel(`moves:${gameId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'game_moves',
            filter: `game_id=eq.${gameId}`,
          },
          handleMovesChange
        )
        .subscribe((status) => {
          handleConnectionChange(status, movesChannel);
        });

      subscriptions.current.moves = movesChannel;

    } catch (error) {
      console.error('❌ Error setting up game subscription:', error);
      setConnectionState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to setup subscription',
      }));
    }
  }, [gameId, handleGameChange, handleMovesChange, handleConnectionChange]);

  // Setup queue subscription
  const setupQueueSubscription = useCallback(async () => {
    if (!user?.id) return;

    console.log('📋 Setting up queue subscription for user:', user.id);
    
    try {
      const queueChannel = supabase
        .channel(`queue:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'game_queue',
            filter: `user_id=eq.${user.id}`,
          },
          handleQueueChange
        )
        .subscribe((status) => {
          handleConnectionChange(status, queueChannel);
        });

      subscriptions.current.queue = queueChannel;

    } catch (error) {
      console.error('❌ Error setting up queue subscription:', error);
      setConnectionState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to setup queue subscription',
      }));
    }
  }, [user?.id, handleQueueChange, handleConnectionChange]);

  // Reconnection logic
  const attemptReconnect = useCallback(() => {
    if (!autoReconnect || reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.log('❌ Max reconnection attempts reached or auto-reconnect disabled');
      setConnectionState(prev => ({
        ...prev,
        isReconnecting: false,
        error: 'Max reconnection attempts reached',
      }));
      return;
    }

    console.log(`🔄 Attempting reconnection ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts}`);
    
    setConnectionState(prev => ({
      ...prev,
      isReconnecting: true,
      reconnectAttempts: reconnectAttemptsRef.current + 1,
    }));

    reconnectAttemptsRef.current += 1;

    // Cleanup existing subscriptions
    cleanupSubscriptions();

    // Wait before attempting to reconnect
    reconnectTimeoutRef.current = setTimeout(() => {
      setupGameSubscription();
      setupQueueSubscription();
    }, reconnectInterval);
  }, [autoReconnect, maxReconnectAttempts, reconnectInterval, cleanupSubscriptions, setupGameSubscription, setupQueueSubscription]);

  // Manual reconnection
  const reconnect = useCallback(() => {
    console.log('🔄 Manual reconnection requested');
    reconnectAttemptsRef.current = 0;
    attemptReconnect();
  }, [attemptReconnect]);

  // Send player action broadcast
  const broadcastPlayerAction = useCallback((action: any) => {
    if (!subscriptions.current.game) return;
    
    console.log('📡 Broadcasting player action:', action);
    subscriptions.current.game.send({
      type: 'broadcast',
      event: 'player_action',
      payload: action,
    });
  }, []);

  // Send turn submitted broadcast
  const broadcastTurnSubmitted = useCallback((turnData: any) => {
    if (!subscriptions.current.game) return;
    
    console.log('📡 Broadcasting turn submitted:', turnData);
    subscriptions.current.game.send({
      type: 'broadcast',
      event: 'turn_submitted',
      payload: turnData,
    });
  }, []);

  // Track presence
  const trackPresence = useCallback((presenceData: any) => {
    if (!subscriptions.current.game || typeof subscriptions.current.game.track !== 'function') return;
    
    console.log('👥 Tracking presence:', presenceData);
    try {
      subscriptions.current.game.track(presenceData);
    } catch (error) {
      console.error('❌ Error tracking presence:', error);
    }
  }, []);

  // Untrack presence
  const untrackPresence = useCallback(() => {
    if (!subscriptions.current.game || typeof subscriptions.current.game.untrack !== 'function') return;
    
    console.log('👥 Untracking presence');
    try {
      subscriptions.current.game.untrack();
    } catch (error) {
      console.error('❌ Error untracking presence:', error);
    }
  }, []);

  // Setup subscriptions on mount
  useEffect(() => {
    if (!user?.id) return;

    console.log('🚀 Setting up real-time subscriptions');
    
    setupGameSubscription();
    setupQueueSubscription();

    // Track user presence
    trackPresence({
      user_id: user.id,
      username: user.email?.split('@')[0] || 'Player',
      status: 'online',
      last_seen: new Date().toISOString(),
    });

    // Cleanup on unmount
    return () => {
      console.log('🧹 Cleaning up real-time subscriptions');
      untrackPresence();
      cleanupSubscriptions();
    };
  }, [user?.id, setupGameSubscription, setupQueueSubscription, trackPresence, untrackPresence, cleanupSubscriptions]);

  // Auto-reconnect on connection loss
  useEffect(() => {
    if (!connectionState.isConnected && 
        !connectionState.isReconnecting && 
        autoReconnect &&
        reconnectAttemptsRef.current < maxReconnectAttempts) {
      console.log('🔌 Connection lost, attempting reconnection');
      attemptReconnect();
    }
  }, [connectionState.isConnected, connectionState.isReconnecting, autoReconnect, maxReconnectAttempts, attemptReconnect]);

  // Clear error after some time
  useEffect(() => {
    if (connectionState.error) {
      const timer = setTimeout(() => {
        setConnectionState(prev => ({ ...prev, error: null }));
      }, 10000); // Clear error after 10 seconds

      return () => clearTimeout(timer);
    }
  }, [connectionState.error]);

  return {
    // Connection state
    isConnected: connectionState.isConnected,
    isReconnecting: connectionState.isReconnecting,
    lastConnected: connectionState.lastConnected,
    reconnectAttempts: connectionState.reconnectAttempts,
    connectionError: connectionState.error,
    
    // Actions
    reconnect,
    broadcastPlayerAction,
    broadcastTurnSubmitted,
    trackPresence,
    untrackPresence,
    
    // Game state (from store)
    currentGame,
    boardState,
    gameStatus,
    winner,
    currentTurn,
    timeRemaining,
    isMyTurn,
    pendingActions,
    gameHistory,
    
    // Game actions (from store)
    startNewGame,
    makeMove,
    submitTurn,
    endTurn,
    updateTimeRemaining,
    resetGame,
    resolveTurn,
  };
}; 