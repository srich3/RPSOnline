import React from 'react';
import { SquareState } from '../../types/game';
import { motion } from 'framer-motion';

interface GameSquareProps {
  square: SquareState;
  isCurrentPlayer: boolean;
  isSelected: boolean;
  pendingActions: Array<{ action_type: string; points_spent: number }>;
  onClick: () => void;
}

const getSquareContent = (square: SquareState) => {
  if (square.owner) {
    if (square.is_defended) {
      return <span className="text-blue-500 font-bold">🛡️</span>;
    }
    return <span className="text-green-500 font-bold">{square.owner === undefined ? '' : '●'}</span>;
  }
  return <span className="text-gray-400">+</span>;
};

const getPendingActionIcon = (actionType: string) => {
  switch (actionType) {
    case 'attack': return '⚔️';
    case 'defend': return '🛡️';
    case 'conquer': return '👑';
    case 'claim': return '🏁';
    default: return '•';
  }
};

const GameSquare: React.FC<GameSquareProps> = ({ 
  square, 
  isCurrentPlayer, 
  isSelected,
  pendingActions,
  onClick 
}) => {
  const totalPendingPoints = pendingActions.reduce((sum, action) => sum + action.points_spent, 0);
  const hasPendingActions = pendingActions.length > 0;

  console.log(`🎲 GameSquare ${square.id}:`, { 
    isSelected, 
    hasPendingActions, 
    pendingActionsCount: pendingActions.length,
    totalPendingPoints,
    pendingActions 
  });

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      className={`aspect-square w-20 h-20 flex flex-col items-center justify-center border-2 rounded-lg shadow-md transition-colors relative
        ${square.owner ? (isCurrentPlayer ? 'border-green-500' : 'border-red-500') : 'border-gray-300'}
        ${square.is_defended ? 'bg-blue-100' : square.owner ? 'bg-green-100' : 'bg-white'}
        ${isSelected ? 'ring-4 ring-blue-400 ring-opacity-50' : ''}
        ${hasPendingActions ? 'ring-2 ring-yellow-400' : ''}
      `}
      onClick={onClick}
      disabled={!!square.owner}
      aria-label={`Square ${square.id}`}
    >
      {/* Main content */}
      <div className="text-lg">
        {getSquareContent(square)}
      </div>
      
      {/* Pending actions indicator */}
      {hasPendingActions && (
        <div className="absolute -top-1 -right-1 bg-yellow-400 text-yellow-900 text-xs px-1 rounded-full font-bold">
          {totalPendingPoints}
        </div>
      )}
      
      {/* Pending action icons */}
      {pendingActions.length > 0 && (
        <div className="absolute bottom-1 left-1 flex gap-1">
          {pendingActions.slice(0, 2).map((action, index) => (
            <span key={index} className="text-xs" title={`${action.action_type}: ${action.points_spent} points`}>
              {getPendingActionIcon(action.action_type)}
            </span>
          ))}
          {pendingActions.length > 2 && (
            <span className="text-xs">+{pendingActions.length - 2}</span>
          )}
        </div>
      )}
    </motion.button>
  );
};

export default GameSquare; 