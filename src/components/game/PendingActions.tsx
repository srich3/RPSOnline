import React from 'react';
import { PlayerAction } from '../../types/game';

interface PendingActionsProps {
  pendingActions: PlayerAction[];
  onRemoveAction: (actionId: string) => void;
  isMyTurn: boolean;
}

const getActionIcon = (actionType: string) => {
  switch (actionType) {
    case 'attack': return '⚔️';
    case 'defend': return '🛡️';
    case 'conquer': return '👑';
    default: return '•';
  }
};

const getActionColor = (actionType: string) => {
  switch (actionType) {
    case 'attack': return 'text-red-600 bg-red-50';
    case 'defend': return 'text-blue-600 bg-blue-50';
    case 'conquer': return 'text-purple-600 bg-purple-50';
    default: return 'text-gray-600 bg-gray-50';
  }
};

const PendingActions: React.FC<PendingActionsProps> = ({
  pendingActions,
  onRemoveAction,
  isMyTurn,
}) => {
  if (pendingActions.length === 0) {
    return (
      <div className="w-full max-w-md p-3 bg-gray-50 rounded text-center text-gray-500 text-sm">
        No pending actions
      </div>
    );
  }

  return (
    <div className="w-full max-w-md p-3 bg-white rounded shadow">
      <h3 className="text-sm font-semibold mb-2 text-gray-700">Pending Actions ({pendingActions.length})</h3>
      <div className="space-y-2">
        {pendingActions.map((action) => (
          <div
            key={action.id}
            className={`flex items-center justify-between p-2 rounded border ${getActionColor(action.action_type)}`}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{getActionIcon(action.action_type)}</span>
              <div>
                <div className="font-medium capitalize">{action.action_type}</div>
                <div className="text-xs opacity-75">
                  Square {action.target_square} • {action.points_spent} points
                </div>
              </div>
            </div>
            <button
              onClick={() => onRemoveAction(action.id)}
              disabled={!isMyTurn}
              className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              title="Remove action"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <div className="mt-2 text-xs text-gray-500">
        Total points: {pendingActions.reduce((sum, action) => sum + action.points_spent, 0)}
      </div>
    </div>
  );
};

export default PendingActions; 