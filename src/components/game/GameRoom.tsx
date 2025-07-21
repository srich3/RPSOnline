import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Clock, Trophy, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { useGameState } from '../../hooks/useGameState';
import { useAuth } from '../../components/auth/AuthProvider';
import { useGameActions } from '../../hooks/useGameActions';
import { useGameStore } from '../../store/gameStore';
import { ActionType } from '../../types/game';
import ConnectionStatus from './ConnectionStatus';
import GameBoard from './GameBoard';
import ActionPanel from './ActionPanel';
import TurnTimer from './TurnTimer';
import PendingActions from './PendingActions';
import LoadingOverlay from '../ui/LoadingOverlay';

interface GameRoomProps {
  gameId: string;
  className?: string;
}

export default function GameRoom({ gameId, className = '' }: GameRoomProps) {
  const { user, profile } = useAuth();
  
  // Game state from useGameState hook
  const {
    // Connection state
    isConnected,
    isReconnecting,
    lastConnected,
    reconnectAttempts,
    connectionError,
    reconnect,
    
    // Game state
    currentGame,
    boardState,
    gameStatus,
    winner,
    currentTurn,
    timeRemaining,
    isMyTurn,
    pendingActions,
    gameHistory,
    
    // Game actions
    startNewGame,
    makeMove,
    submitTurn,
    endTurn,
    updateTimeRemaining,
    resetGame,
    resolveTurn,
  } = useGameState({
    gameId,
    autoReconnect: true,
    reconnectInterval: 3000,
    maxReconnectAttempts: 5,
  });

  // Game actions from useGameActions hook
  const {
    remainingPoints,
    canSubmitTurn,
    selectedSquare,
    handleSubmitTurn,
    handleSquareClick,
    getStatusMessage,
    attackSquare,
    defendSquare,
    conquerSquare,
    removeAction,
    clearAllActions,
  } = useGameActions();

  const [showDisconnectWarning, setShowDisconnectWarning] = useState(false);

  // Show disconnect warning when connection is lost
  useEffect(() => {
    if (!isConnected && !isReconnecting && gameStatus === 'active') {
      setShowDisconnectWarning(true);
    } else {
      setShowDisconnectWarning(false);
    }
  }, [isConnected, isReconnecting, gameStatus]);

  // Auto-hide disconnect warning after 5 seconds
  useEffect(() => {
    if (showDisconnectWarning) {
      const timer = setTimeout(() => {
        setShowDisconnectWarning(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showDisconnectWarning]);

  // Handle action from ActionPanel
  const handleAction = (actionType: ActionType, points: number) => {
    console.log('🎯 handleAction called:', { actionType, points, selectedSquare });
    if (selectedSquare === null) {
      console.log('❌ handleAction - no selected square');
      return;
    }
    
    switch (actionType) {
      case 'attack':
        console.log('⚔️ Calling attackSquare:', { selectedSquare, points });
        attackSquare(selectedSquare, points);
        break;
      case 'defend':
        console.log('🛡️ Calling defendSquare:', { selectedSquare, points });
        defendSquare(selectedSquare, points);
        break;
      case 'conquer':
        console.log('👑 Calling conquerSquare:', { selectedSquare, points });
        conquerSquare(selectedSquare, points);
        break;
      default:
        console.log(`❌ Unknown action type: ${actionType}`);
    }
  };

  // Get selected square data
  const getSelectedSquareData = () => {
    if (selectedSquare === null || !boardState) return undefined;
    return boardState.squares[selectedSquare];
  };

  const getPlayerInfo = (playerId: string) => {
    // This would normally fetch from the database
    // For now, return mock data
    return {
      id: playerId,
      username: playerId === user?.id ? profile?.username || 'You' : 'Opponent',
      rating: playerId === user?.id ? profile?.rating || 100 : 100,
      isOnline: isConnected,
    };
  };

  const player1 = currentGame ? getPlayerInfo(currentGame.player1_id) : null;
  const player2 = currentGame?.player2_id ? getPlayerInfo(currentGame.player2_id) : null;

  const getGameStatusMessage = () => {
    if (winner) {
      const isWinner = winner === user?.id;
      return isWinner ? '🎉 You won!' : '😔 You lost';
    }
    
    if (gameStatus === 'waiting') return 'Waiting for opponent...';
    if (gameStatus === 'finished') return 'Game finished';
    if (!isConnected) return 'Connection lost';
    if (isMyTurn) return 'Your turn';
    return "Opponent's turn";
  };

  const getGameStatusColor = () => {
    if (winner) return winner === user?.id ? 'text-green-400' : 'text-red-400';
    if (!isConnected) return 'text-red-400';
    if (isMyTurn) return 'text-blue-400';
    return 'text-gray-400';
  };

  // Debug logging
  console.log('🎮 GameRoom render state:', {
    currentGame: !!currentGame,
    boardState: !!boardState,
    currentTurn: !!currentTurn,
    gameStatus,
    isConnected
  });

  if (!currentGame || !boardState || !currentTurn) {
    return (
      <div className={`bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 shadow-lg border border-gray-700 ${className}`}>
        <div className="text-center">
          <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Loading Game</h3>
          <p className="text-gray-400">Connecting to game room...</p>
          <div className="text-xs text-gray-500 mt-2">
            Debug: {!currentGame ? 'No game' : ''} {!boardState ? 'No board' : ''} {!currentTurn ? 'No turn' : ''}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-bg)]">
      <div className="w-full max-w-3xl mx-auto p-4 bg-[var(--color-bg)] rounded-lg border border-[var(--color-dark-soft)] shadow-xl">
        <h1 className="text-2xl font-bold text-center mb-4 text-[var(--color-fg)]">Game Room</h1>
        <div className="mb-6">
          <GameBoard
            boardState={boardState}
            currentTurn={currentTurn}
            selectedSquare={selectedSquare}
            pendingActions={pendingActions}
            onSquareClick={handleSquareClick}
          />
        </div>
        <ActionPanel
          remainingPoints={remainingPoints}
          selectedSquare={selectedSquare}
          selectedSquareData={getSelectedSquareData()}
          onAction={handleAction}
          onSubmit={handleSubmitTurn}
          onClearAll={clearAllActions}
          canSubmit={canSubmitTurn()}
          isMyTurn={isMyTurn}
          timeRemaining={currentTurn.time_remaining}
          currentPlayerId={currentTurn.player_id}
          pendingActionsCount={pendingActions.length}
          className="bg-[var(--color-light-soft)] border border-[var(--color-dark-soft)] text-[var(--color-fg)]"
        />
        <PendingActions
          pendingActions={pendingActions}
          onRemoveAction={removeAction}
          isMyTurn={isMyTurn}
          className="bg-[var(--color-bg)] text-[var(--color-fg)]"
        />
        <TurnTimer
          timeRemaining={currentTurn.time_remaining}
          currentPlayerId={currentTurn.player_id}
          className="bg-[var(--color-dark-soft)] text-[var(--color-light)]"
        />
      </div>
    </div>
  );
} 