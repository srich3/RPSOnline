import { useEffect, useRef, useCallback, useState } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/auth/AuthProvider';
import { useGameStore } from '../store/gameStore';
import type { GameBoardState } from '../types/game';

interface RealTimeGameState {
  isConnected: boolean;
  isReconnecting: boolean;
  lastConnected: Date | null;
  reconnectAttempts: number;
  connectionError: string | null;
  opponentOnline: boolean;
  opponentLastSeen: Date | null;
}

interface UseRealTimeGameOptions {
  gameId: string;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
}

export const useRealTimeGame = (options: UseRealTimeGameOptions) => {
  const {
    gameId,
    autoReconnect = true,
    maxReconnectAttempts = 5,
  } = options;

  const { user } = useAuth();
  const { currentGame, boardState } = useGameStore();

  // State
  const [state, setState] = useState<RealTimeGameState>({
    isConnected: false,
    isReconnecting: false,
    lastConnected: null,
    reconnectAttempts: 0,
    connectionError: null,
    opponentOnline: false,
    opponentLastSeen: null,
  });

  // Refs
  const gameChannel = useRef<RealtimeChannel | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);

  // Initialize game channel for real-time updates
  const initializeGameChannel = useCallback(async () => {
    if (!user?.id || !gameId) return;

    console.log(`🎮 Initializing real-time game channel for game: ${gameId}`);

    // Create game channel
    gameChannel.current = supabase
      .channel(`game:${gameId}`, {
        config: {
          presence: {
            key: user.id,
          },
        },
      })
      .on('presence', { event: 'sync' }, () => {
        console.log('👥 Presence sync event');
        updateOpponentStatus();
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('👋 Player joined:', key, newPresences);
        updateOpponentStatus();
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('👋 Player left:', key, leftPresences);
        updateOpponentStatus();
      })
      .on(
        'broadcast',
        { event: 'game_state_update' },
        (payload) => {
          console.log('📡 Game state update received:', payload);
          handleGameStateUpdate(payload.payload);
        }
      )
      .on(
        'broadcast',
        { event: 'player_action' },
        (payload) => {
          console.log('📡 Player action received:', payload);
          handlePlayerAction(payload.payload);
        }
      )
      .on(
        'broadcast',
        { event: 'turn_submitted' },
        (payload) => {
          console.log('📡 Turn submitted received:', payload);
          handleTurnSubmitted(payload.payload);
        }
      )
      .on(
        'broadcast',
        { event: 'turn_resolved' },
        (payload) => {
          console.log('📡 Turn resolved received:', payload);
          handleTurnResolved(payload.payload);
        }
      )
      .on(
        'broadcast',
        { event: 'game_ended' },
        (payload) => {
          console.log('📡 Game ended received:', payload);
          handleGameEnded(payload.payload);
        }
      )
      .subscribe((status) => {
        console.log(`🎮 Game channel status: ${status}`);
        handleConnectionStatus(status);
      });

    // Track presence only once on initial connection
    await gameChannel.current.track({
      user_id: user.id,
      status: 'online',
    });

    setState(prev => ({
      ...prev,
      isConnected: true,
      lastConnected: new Date(),
      connectionError: null,
    }));
  }, [user?.id, gameId]);

  // Update opponent status based on presence
  const updateOpponentStatus = useCallback(() => {
    if (!gameChannel.current || !user?.id || !currentGame) return;

    const presence = gameChannel.current.presenceState();
    const opponentId = currentGame.player1_id === user.id 
      ? currentGame.player2_id 
      : currentGame.player1_id;

    const opponentPresence = presence[opponentId];
    const isOnline = opponentPresence && opponentPresence.length > 0;
    const lastSeen = isOnline 
      ? new Date(opponentPresence[0].online_at) 
      : state.opponentLastSeen;

    setState(prev => ({
      ...prev,
      opponentOnline: isOnline,
      opponentLastSeen: lastSeen,
    }));
  }, [user?.id, currentGame, state.opponentLastSeen]);

  // Handle connection status changes
  const handleConnectionStatus = useCallback((status: string) => {
    switch (status) {
      case 'SUBSCRIBED':
        setState(prev => ({
          ...prev,
          isConnected: true,
          isReconnecting: false,
          reconnectAttempts: 0,
          connectionError: null,
        }));
        break;
      case 'CHANNEL_ERROR':
        setState(prev => {
          if (autoReconnect && prev.reconnectAttempts < maxReconnectAttempts) {
            scheduleReconnect();
          }
          return {
            ...prev,
            isConnected: false,
            connectionError: 'Channel error occurred',
          };
        });
        break;
      case 'TIMED_OUT':
        setState(prev => {
          if (autoReconnect && prev.reconnectAttempts < maxReconnectAttempts) {
            scheduleReconnect();
          }
          return {
            ...prev,
            isConnected: false,
            connectionError: 'Connection timed out',
          };
        });
        break;
      case 'CLOSED':
        setState(prev => ({
          ...prev,
          isConnected: false,
        }));
        break;
    }
  }, [autoReconnect, maxReconnectAttempts]);

  // Schedule reconnection
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
    }

    setState(prev => ({
      ...prev,
      isReconnecting: true,
      reconnectAttempts: prev.reconnectAttempts + 1,
    }));

    const delay = Math.min(1000 * Math.pow(2, state.reconnectAttempts), 30000);
    console.log(`🔄 Scheduling reconnect in ${delay}ms (attempt ${state.reconnectAttempts + 1})`);

    reconnectTimeout.current = setTimeout(() => {
      initializeGameChannel();
    }, delay);
  }, [state.reconnectAttempts]); // Remove initializeGameChannel from dependencies

  // Handle game state updates
  const handleGameStateUpdate = useCallback((payload: any) => {
    const { gameState, boardState } = payload;
    if (gameState) {
      // Update game state in store
      useGameStore.setState({
        currentGame: gameState,
        boardState: boardState,
      });
    }
  }, []);

  // Handle player actions
  const handlePlayerAction = useCallback((payload: any) => {
    const { playerId, action } = payload;
    if (playerId !== user?.id) {
      // This is opponent's action - we might want to show it in UI
      console.log('👤 Opponent action:', action);
    }
  }, [user?.id]);

  // Handle turn submissions
  const handleTurnSubmitted = useCallback((payload: any) => {
    const { playerId, turnData } = payload;
    console.log(`📝 Player ${playerId} submitted turn:`, turnData);
    
    // Update local game state with submitted turn
    if (boardState) {
      const isPlayer1 = playerId === currentGame?.player1_id;
      const isPlayer2 = playerId === currentGame?.player2_id;
      
      const updatedBoardState = { ...boardState };
      if (isPlayer1) updatedBoardState.player1_submitted = true;
      if (isPlayer2) updatedBoardState.player2_submitted = true;
      
      useGameStore.setState({ boardState: updatedBoardState });
      
      // If both players submitted, resolve turn
      if (updatedBoardState.player1_submitted && updatedBoardState.player2_submitted) {
        // Call resolveTurn from the store
        useGameStore.getState().resolveTurn();
      }
    }
  }, [boardState, currentGame]);

  // Handle turn resolution
  const handleTurnResolved = useCallback((payload: any) => {
    const { newBoardState, nextTurn } = payload;
    console.log('🔄 Turn resolved:', { newBoardState, nextTurn });
    
    useGameStore.setState({
      boardState: newBoardState,
      currentTurn: nextTurn,
    });
  }, []);

  // Handle game end
  const handleGameEnded = useCallback((payload: any) => {
    const { winner, finalState } = payload;
    console.log('🏁 Game ended:', { winner, finalState });
    
    useGameStore.setState({
      gameStatus: 'finished',
      winner,
      boardState: finalState,
    });
  }, []);

  // Broadcast game state (minimal - only for essential updates)
  const broadcastGameState = useCallback(async (gameState: any, boardState: GameBoardState) => {
    if (!gameChannel.current || !state.isConnected) return;

    try {
      await gameChannel.current.send({
        type: 'broadcast',
        event: 'game_state_update',
        payload: { gameState, boardState },
      });
      console.log('📡 Game state broadcast sent');
    } catch (error) {
      console.error('❌ Error broadcasting game state:', error);
    }
  }, [state.isConnected]);

  // Broadcast player action (minimal - only for essential actions)
  const broadcastPlayerAction = useCallback(async (playerId: string, action: any) => {
    if (!gameChannel.current || !state.isConnected) return;

    try {
      await gameChannel.current.send({
        type: 'broadcast',
        event: 'player_action',
        payload: { playerId, action },
      });
      console.log('📡 Player action broadcast sent');
    } catch (error) {
      console.error('❌ Error broadcasting player action:', error);
    }
  }, [state.isConnected]);

  // Broadcast turn submitted (CRITICAL - this is one of the main database calls)
  const broadcastTurnSubmitted = useCallback(async (playerId: string, turnData: any) => {
    if (!gameChannel.current || !state.isConnected) return;

    try {
      await gameChannel.current.send({
        type: 'broadcast',
        event: 'turn_submitted',
        payload: { playerId, turnData },
      });
      console.log('📡 Turn submission broadcast sent');
    } catch (error) {
      console.error('❌ Error broadcasting turn submission:', error);
    }
  }, [state.isConnected]);

  // Broadcast turn resolution (CRITICAL - this is one of the main database calls)
  const broadcastTurnResolved = useCallback(async (newBoardState: GameBoardState, nextTurn: any) => {
    if (!gameChannel.current || !state.isConnected) return;

    try {
      await gameChannel.current.send({
        type: 'broadcast',
        event: 'turn_resolved',
        payload: { newBoardState, nextTurn },
      });
      console.log('📡 Turn resolution broadcast sent');
    } catch (error) {
      console.error('❌ Error broadcasting turn resolution:', error);
    }
  }, [state.isConnected]);

  // Broadcast game end
  const broadcastGameEnded = useCallback(async (winner: string, finalState: GameBoardState) => {
    if (!gameChannel.current || !state.isConnected) return;

    try {
      await gameChannel.current.send({
        type: 'broadcast',
        event: 'game_ended',
        payload: { winner, finalState },
      });
      console.log('📡 Game end broadcast sent');
    } catch (error) {
      console.error('❌ Error broadcasting game end:', error);
    }
  }, [state.isConnected]);

  // Manual reconnect function
  const reconnect = useCallback(async () => {
    console.log('🔄 Manual reconnect requested');
    if (gameChannel.current) {
      await gameChannel.current.unsubscribe();
    }
    setState(prev => ({ ...prev, reconnectAttempts: 0 }));
    await initializeGameChannel();
  }, []); // Remove initializeGameChannel from dependencies

  // Initialize on mount - NO HEARTBEAT to minimize database calls
  useEffect(() => {
    if (gameId && user?.id) {
      initializeGameChannel();
      // REMOVED: setupHeartbeat() - no more 30-second database calls
    }

    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
      if (gameChannel.current) {
        gameChannel.current.unsubscribe();
      }
    };
  }, [gameId, user?.id]); // Remove initializeGameChannel and setupHeartbeat from dependencies

  // Update opponent status when presence changes
  useEffect(() => {
    if (state.isConnected) {
      updateOpponentStatus();
    }
  }, [state.isConnected]); // Remove updateOpponentStatus from dependencies

  return {
    // State
    isConnected: state.isConnected,
    isReconnecting: state.isReconnecting,
    lastConnected: state.lastConnected,
    reconnectAttempts: state.reconnectAttempts,
    connectionError: state.connectionError,
    opponentOnline: state.opponentOnline,
    opponentLastSeen: state.opponentLastSeen,

    // Actions
    reconnect,
    broadcastGameState,
    broadcastPlayerAction,
    broadcastTurnSubmitted,
    broadcastTurnResolved,
    broadcastGameEnded,
  };
}; 