"use client";

import React, { useEffect } from 'react';
import GameBoard from '../../components/game/GameBoard';
import ActionPanel from '../../components/game/ActionPanel';
import PendingActions from '../../components/game/PendingActions';
import TurnTimer from '../../components/game/TurnTimer';
import { useGameActions } from '../../hooks/useGameActions';
import { useGameStore } from '../../store/gameStore';
import { ActionType } from '../../types/game';

const GamePage: React.FC = () => {
  const {
    boardState,
    currentTurn,
    isMyTurn,
    gameStatus,
    winner,
    remainingPoints,
    canSubmitTurn,
    selectedSquare,
    pendingActions,
    handleSubmitTurn,
    handleSquareClick,
    getStatusMessage,
    attackSquare,
    defendSquare,
    conquerSquare,
    removeAction,
    clearAllActions,
  } = useGameActions();

  const startNewGame = useGameStore((state) => state.startNewGame);

  // Start a new game on mount (for demo, player1 vs player2)
  useEffect(() => {
    startNewGame('player1', 'player2');
  }, [startNewGame]);

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

  if (!boardState || !currentTurn) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen bg-gray-50 py-8">
        <h1 className="text-2xl font-bold mb-6">RPSOnline Game Board</h1>
        <p>Loading game...</p>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gray-50 py-8">
      <h1 className="text-2xl font-bold mb-6">RPSOnline Game Board</h1>
      
      {/* Turn Timer - Top of Game Area */}
      <div className="mb-6 w-full max-w-md">
        <TurnTimer />
      </div>
      
      {/* Desktop Layout */}
      <div className="hidden md:flex gap-6 items-start">
        {/* Left Side - Pending Actions */}
        <div className="w-64 flex-shrink-0">
          <PendingActions
            pendingActions={pendingActions}
            onRemoveAction={removeAction}
            isMyTurn={isMyTurn}
          />
        </div>
        
        {/* Center - Game Board and Action Panel */}
        <div className="flex flex-col items-center">
          <GameBoard
            boardState={boardState}
            currentTurn={currentTurn}
            selectedSquare={selectedSquare}
            pendingActions={pendingActions}
            onSquareClick={handleSquareClick}
          />
          <div className="mt-4 text-gray-700">
            <p>{getStatusMessage}</p>
            {winner && (
              <div className="mt-4 text-xl font-bold text-green-600">Winner: {winner}</div>
            )}
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
          />
        </div>
        
        {/* Right Side - Future Chat Window / Game Log */}
        <div className="w-64 flex-shrink-0">
          <div className="p-4 bg-white rounded shadow">
            <h3 className="text-lg font-semibold mb-2 text-gray-700">Game Log</h3>
            <div className="text-sm text-gray-500">
              <p>Chat window and game log will be added here in a future update.</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Mobile Layout */}
      <div className="md:hidden flex flex-col items-center">
        <GameBoard
          boardState={boardState}
          currentTurn={currentTurn}
          selectedSquare={selectedSquare}
          pendingActions={pendingActions}
          onSquareClick={handleSquareClick}
        />
        <div className="mt-4 text-gray-700">
          <p>{getStatusMessage}</p>
          {winner && (
            <div className="mt-4 text-xl font-bold text-green-600">Winner: {winner}</div>
          )}
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
        />
        <PendingActions
          pendingActions={pendingActions}
          onRemoveAction={removeAction}
          isMyTurn={isMyTurn}
        />
      </div>
    </main>
  );
};

export default GamePage; 