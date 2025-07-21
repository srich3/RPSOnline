import React, { useState } from 'react';
import { ActionType } from '../../types/game';

interface ActionPanelProps {
  remainingPoints: number;
  selectedSquare: number | null;
  selectedSquareData?: { owner?: string; is_defended: boolean };
  onAction: (actionType: ActionType, points: number) => void;
  onSubmit: () => void;
  onClearAll?: () => void;
  canSubmit: boolean;
  isMyTurn: boolean;
  timeRemaining: number;
  currentPlayerId?: string;
  pendingActionsCount?: number;
  className?: string;
}

const ALL_ACTIONS: { type: ActionType; label: string; minPoints: number }[] = [
  { type: 'attack', label: 'Attack', minPoints: 1 },
  { type: 'defend', label: 'Defend', minPoints: 1 },
  { type: 'conquer', label: 'Conquer', minPoints: 2 },
];

const ActionPanel: React.FC<ActionPanelProps> = ({
  remainingPoints,
  selectedSquare,
  selectedSquareData,
  onAction,
  onSubmit,
  onClearAll,
  canSubmit,
  isMyTurn,
  timeRemaining,
  currentPlayerId,
  pendingActionsCount = 0,
  className,
}) => {
  const [selectedAction, setSelectedAction] = useState<ActionType>('conquer');
  const [points, setPoints] = useState(2);

  // Get available actions based on selected square state
  const getAvailableActions = () => {
    if (!selectedSquareData || !currentPlayerId) return ALL_ACTIONS;
    
    // In simultaneous turn-based game, all actions are available for planning
    // Actions will resolve in order: Defend → Attack → Conquer
    return ALL_ACTIONS;
  };

  const availableActions = getAvailableActions();

  const handleActionChange = (action: ActionType) => {
    setSelectedAction(action);
    setPoints(availableActions.find(a => a.type === action)?.minPoints || 1);
  };

  const handlePointsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(
      availableActions.find(a => a.type === selectedAction)?.minPoints || 1,
      Math.min(Number(e.target.value), remainingPoints)
    );
    setPoints(value);
  };

  const handleAddAction = () => {
    if (selectedSquare === null) return;
    onAction(selectedAction, points);
    setPoints(availableActions.find(a => a.type === selectedAction)?.minPoints || 1);
  };

  const canAddAction = selectedSquare !== null && isMyTurn && points <= remainingPoints;

  return (
    <div className={`p-4 rounded-lg border border-[var(--color-dark-soft)] bg-[var(--color-bg)] ${className}`}>
      <h2 className="text-xl font-bold mb-2 text-[var(--color-fg)]">Actions</h2>
      <div className="flex gap-2 mb-4">
        {availableActions.map((action) => (
          <button
            key={action.type}
            className={`px-4 py-2 rounded-lg font-bold bg-[var(--color-dark-soft)] text-[var(--color-light)] hover:brightness-90 transition-colors ${selectedAction === action.type ? 'bg-[var(--color-blue)] text-[var(--color-light)]' : 'bg-[var(--color-gray-100)] text-[var(--color-gray-700)]'}`}
            onClick={() => handleActionChange(action.type)}
            disabled={!isMyTurn}
          >
            {action.label}
          </button>
        ))}
      </div>
            {/* Selected Square Info */}
            {selectedSquare !== null ? (
        <div className="mb-4 p-2 bg-[var(--color-blue-50)] rounded text-center">
          <p className="text-sm text-[var(--color-blue-700)]">Selected Square: {selectedSquare}</p>
          {selectedSquareData && (
            <div className="text-xs text-[var(--color-blue-600)]">
              <p>
                {selectedSquareData.owner ? 
                  (selectedSquareData.owner === currentPlayerId ? 'Your square' : `Enemy square (${selectedSquareData.owner})`) : 
                  'Empty square'
                }
                {selectedSquareData.is_defended && ' (Defended)'}
              </p>
              <p className="mt-1 text-[var(--color-blue-500)]">
                All actions available for planning
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="mb-4 p-2 bg-[var(--color-yellow-50)] rounded text-center">
          <p className="text-sm text-[var(--color-yellow-700)]">Select a square on the board first</p>
        </div>
      )}

      <div className="flex items-center gap-2 mb-4">

        <button
          className={`ml-2 px-3 py-1 rounded transition ${canAddAction ? 'bg-[var(--color-green-600)] text-[var(--color-light)] hover:bg-[var(--color-green-700)]' : 'bg-[var(--color-gray-300)] text-[var(--color-gray-500)] cursor-not-allowed'}`}
          onClick={handleAddAction}
          disabled={!canAddAction}
        >
          Add Action
        </button>
      </div>
      <div className="mb-2 text-[var(--color-gray-600)]">Remaining Points: <span className="font-bold">{remainingPoints}</span></div>
      <div className="mb-4 text-[var(--color-gray-600)]">Time Left: <span className="font-bold">{timeRemaining}s</span></div>
      
      <div className="flex gap-2 w-full">
        {onClearAll && pendingActionsCount > 0 && (
          <button
            className="flex-1 py-2 bg-[var(--color-gray-500)] text-[var(--color-light)] rounded font-bold hover:bg-[var(--color-gray-600)] transition"
            onClick={onClearAll}
            disabled={!isMyTurn}
          >
            Clear All
          </button>
        )}
        <button
          className={`flex-1 py-2 rounded font-bold transition ${canSubmit ? 'bg-[var(--color-blue-600)] text-[var(--color-light)] hover:bg-[var(--color-blue-700)]' : 'bg-[var(--color-gray-300)] text-[var(--color-gray-500)] cursor-not-allowed'}`}
          onClick={onSubmit}
          disabled={!canSubmit}
        >
          Submit Turn
        </button>
      </div>
    </div>
  );
};

export default ActionPanel; 