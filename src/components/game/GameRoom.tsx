import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Clock, Trophy, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { useGameState } from '../../hooks/useGameState';
import { useAuth } from '../../components/auth/AuthProvider';
import ConnectionStatus from './ConnectionStatus';
import GameBoard from './GameBoard';
import ActionPanel from './ActionPanel';
import TurnTimer from './TurnTimer';

interface GameRoomProps {
  gameId: string;
  className?: string;
}

export default function GameRoom({ gameId, className = '' }: GameRoomProps) {
  const { user, profile } = useAuth();
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

  const getPlayerInfo = (playerId: string) => {
    // This would normally fetch from the database
    // For now, return mock data
    return {
      id: playerId,
      username: playerId === user?.id ? profile?.username || 'You' : 'Opponent',
      rating: playerId === user?.id ? profile?.rating || 1000 : 1000,
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

  if (!currentGame) {
    return (
      <div className={`bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 shadow-lg border border-gray-700 ${className}`}>
        <div className="text-center">
          <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Loading Game</h3>
          <p className="text-gray-400">Connecting to game room...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl shadow-lg border border-gray-700 overflow-hidden ${className}`}>
      {/* Game Header */}
      <div className="bg-gray-700/50 p-4 border-b border-gray-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-bold text-white">Game #{gameId.slice(0, 8)}</h2>
            <ConnectionStatus
              isConnected={isConnected}
              isReconnecting={isReconnecting}
              lastConnected={lastConnected}
              reconnectAttempts={reconnectAttempts}
              connectionError={connectionError}
              onReconnect={reconnect}
            />
          </div>
          
          <div className="text-right">
            <div className={`text-sm font-medium ${getGameStatusColor()}`}>
              {getGameStatusMessage()}
            </div>
            {gameStatus === 'active' && (
              <div className="text-xs text-gray-400">
                Turn {currentGame.turn_number || 1}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Players Info */}
      <div className="p-4 bg-gray-700/30">
        <div className="grid grid-cols-2 gap-4">
          {/* Player 1 */}
          <div className="bg-gray-700/50 rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-2">
              <div className={`w-2 h-2 rounded-full ${player1?.isOnline ? 'bg-green-400' : 'bg-red-400'}`} />
              <span className="text-white font-medium">{player1?.username}</span>
              {currentTurn?.player_id === player1?.id && (
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="w-2 h-2 bg-blue-400 rounded-full"
                />
              )}
            </div>
            <div className="text-sm text-gray-400">
              Rating: {player1?.rating}
            </div>
            {boardState && (
              <div className="text-sm text-gray-400">
                Points: {boardState.player1_points}
              </div>
            )}
          </div>

          {/* Player 2 */}
          <div className="bg-gray-700/50 rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-2">
              <div className={`w-2 h-2 rounded-full ${player2?.isOnline ? 'bg-green-400' : 'bg-red-400'}`} />
              <span className="text-white font-medium">{player2?.username}</span>
              {currentTurn?.player_id === player2?.id && (
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="w-2 h-2 bg-blue-400 rounded-full"
                />
              )}
            </div>
            <div className="text-sm text-gray-400">
              Rating: {player2?.rating}
            </div>
            {boardState && (
              <div className="text-sm text-gray-400">
                Points: {boardState.player2_points}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Game Content */}
      <div className="p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Game Board */}
          <div className="lg:col-span-2">
            {boardState && currentTurn && (
              <GameBoard
                boardState={boardState}
                currentTurn={currentTurn}
                selectedSquare={null} // This should come from game state
                pendingActions={pendingActions}
                onSquareClick={(squareId) => {
                  // Handle square click logic
                  console.log('Square clicked:', squareId);
                }}
              />
            )}
          </div>

          {/* Game Controls */}
          <div className="space-y-4">
            {/* Turn Timer */}
            {gameStatus === 'active' && (
              <TurnTimer />
            )}

            {/* Action Panel */}
            {gameStatus === 'active' && isMyTurn && boardState && currentTurn && (
              <ActionPanel
                remainingPoints={boardState.player1_points}
                selectedSquare={null} // This should come from game state
                onAction={(actionType, points) => {
                  // Handle action logic
                  console.log('Action:', actionType, points);
                }}
                onSubmit={submitTurn}
                canSubmit={pendingActions.length > 0}
                isMyTurn={isMyTurn}
                timeRemaining={timeRemaining}
                currentPlayerId={user?.id}
                pendingActionsCount={pendingActions.length}
              />
            )}

            {/* Game History */}
            <div className="bg-gray-700/50 rounded-lg p-4">
              <h4 className="text-white font-medium mb-3 flex items-center">
                <Clock className="w-4 h-4 mr-2" />
                Recent Moves
              </h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {gameHistory.slice(-5).map((move) => (
                  <div key={move.id} className="text-sm text-gray-400">
                    <span className="text-white">{move.player_id === user?.id ? 'You' : 'Opponent'}</span>
                    {' '}
                    <span className="text-gray-500">{move.action_type}</span>
                    {' '}
                    <span className="text-gray-600">square {move.target_square}</span>
                  </div>
                ))}
                {gameHistory.length === 0 && (
                  <div className="text-sm text-gray-500">No moves yet</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Disconnect Warning */}
      <AnimatePresence>
        {showDisconnectWarning && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-4 left-4 right-4 bg-red-900/90 border border-red-700 rounded-lg p-4 z-50"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <WifiOff className="w-5 h-5 text-red-400" />
                <div>
                  <div className="text-white font-medium">Connection Lost</div>
                  <div className="text-red-300 text-sm">
                    Attempting to reconnect... ({reconnectAttempts}/5)
                  </div>
                </div>
              </div>
              
              <button
                onClick={reconnect}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors"
              >
                Reconnect
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Over Modal */}
      <AnimatePresence>
        {winner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 shadow-xl border border-gray-700 max-w-md w-full text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
                  winner === user?.id ? 'bg-green-500/20' : 'bg-red-500/20'
                }`}
              >
                <Trophy className={`w-10 h-10 ${
                  winner === user?.id ? 'text-green-400' : 'text-red-400'
                }`} />
              </motion.div>

              <h3 className="text-xl font-bold text-white mb-2">
                {winner === user?.id ? 'Victory!' : 'Defeat'}
              </h3>
              
              <p className="text-gray-400 mb-6">
                {winner === user?.id 
                  ? 'Congratulations! You won the game!' 
                  : 'Better luck next time!'}
              </p>

              <div className="flex space-x-3">
                <button
                  onClick={() => window.location.href = '/dashboard'}
                  className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  Back to Dashboard
                </button>
                
                <button
                  onClick={() => window.location.reload()}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  Play Again
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 