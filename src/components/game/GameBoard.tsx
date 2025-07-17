import React from 'react';
import { GameBoardState, PlayerTurn, SquareState } from '../../types/game';
import GameSquare from './GameSquare';

interface GameBoardProps {
  boardState: GameBoardState;
  currentTurn: PlayerTurn;
  selectedSquare: number | null;
  pendingActions: Array<{ target_square: number; action_type: string; points_spent: number }>;
  onSquareClick: (squareId: number) => void;
}

const GameBoard: React.FC<GameBoardProps> = ({
  boardState,
  currentTurn,
  selectedSquare,
  pendingActions,
  onSquareClick
}) => {
  console.log('🎮 GameBoard render:', { 
    selectedSquare, 
    pendingActionsCount: pendingActions.length,
    pendingActions 
  });

  return (
    <div className="grid grid-cols-3 gap-2 w-full max-w-xs mx-auto">
      {boardState.squares.map((square) => {
        const squarePendingActions = pendingActions.filter(
          action => action.target_square === square.id
        );
        
        console.log(`🎯 Square ${square.id} pending actions:`, squarePendingActions);
        
        return (
          <GameSquare
            key={square.id}
            square={square}
            isCurrentPlayer={currentTurn.player_id === square.owner}
            isSelected={selectedSquare === square.id}
            pendingActions={squarePendingActions}
            onClick={() => onSquareClick(square.id)}
          />
        );
      })}
    </div>
  );
};

export default GameBoard; 