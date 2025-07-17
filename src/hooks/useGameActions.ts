import { useCallback, useMemo } from 'react';
import { useGameStore } from '../store/gameStore';
import { PlayerAction, ActionType } from '../types/game';
import { isValidMove } from '../utils/gameLogic';

export const useGameActions = () => {
  const {
    boardState,
    currentTurn,
    pendingActions,
    selectedSquare,
    selectedAction,
    isMyTurn,
    timeRemaining,
    gameStatus,
    winner,
    makeMove,
    selectSquare,
    selectAction,
    addPointsToAction,
    submitTurn,
    removeAction,
    clearAllActions,
    getAvailableActions: getStoreAvailableActions,
    canSubmitTurn,
  } = useGameStore();

  // Get available actions for current player
  const availableActions = useMemo(() => {
    if (!boardState || !currentTurn) return [];
    return getStoreAvailableActions();
  }, [boardState, currentTurn, getStoreAvailableActions]);

  // Check if a specific action is valid
  const isActionValid = useCallback(
    (action: PlayerAction): boolean => {
      console.log('🔍 isActionValid called:', action);
      if (!boardState || !currentTurn) {
        console.log('❌ isActionValid - no boardState or currentTurn');
        return false;
      }
      
      const targetSquare = boardState.squares[action.target_square];
      console.log('🎯 Target square:', targetSquare);
      console.log('👤 Current turn:', currentTurn);
      
      const isValid = isValidMove(action, boardState, currentTurn.player_id);
      console.log('✅ isActionValid result:', isValid);
      return isValid;
    },
    [boardState, currentTurn]
  );

  // Create and validate a new action
  const createAction = useCallback(
    (actionType: ActionType, targetSquare: number, pointsSpent: number): PlayerAction | null => {
      if (!currentTurn) return null;
      const action: PlayerAction = {
        id: crypto.randomUUID(),
        action_type: actionType,
        target_square: targetSquare,
        points_spent: pointsSpent,
        timestamp: new Date().toISOString(),
      };
      return isActionValid(action) ? action : null;
    },
    [currentTurn, isActionValid]
  );

  // Add a claim action
  const claimSquare = useCallback(
    (squareId: number, points: number = 1) => {
      console.log('🔵 claimSquare called:', { squareId, points });
      const action = createAction('claim', squareId, points);
      if (action) {
        console.log('✅ claimSquare - action created:', action);
        makeMove(action);
        return true;
      }
      console.log('❌ claimSquare - action creation failed');
      return false;
    },
    [createAction, makeMove]
  );

  // Add an attack action
  const attackSquare = useCallback(
    (squareId: number, points: number) => {
      console.log('⚔️ attackSquare called:', { squareId, points });
      const action = createAction('attack', squareId, points);
      if (action) {
        console.log('✅ attackSquare - action created:', action);
        makeMove(action);
        return true;
      }
      console.log('❌ attackSquare - action creation failed');
      return false;
    },
    [createAction, makeMove]
  );

  // Add a defend action
  const defendSquare = useCallback(
    (squareId: number, points: number) => {
      console.log('🛡️ defendSquare called:', { squareId, points });
      const action = createAction('defend', squareId, points);
      if (action) {
        console.log('✅ defendSquare - action created:', action);
        makeMove(action);
        return true;
      }
      console.log('❌ defendSquare - action creation failed');
      return false;
    },
    [createAction, makeMove]
  );

  // Add a conquer action
  const conquerSquare = useCallback(
    (squareId: number, points: number) => {
      console.log('👑 conquerSquare called:', { squareId, points });
      const action = createAction('conquer', squareId, points);
      if (action) {
        console.log('✅ conquerSquare - action created:', action);
        makeMove(action);
        return true;
      }
      console.log('❌ conquerSquare - action creation failed');
      return false;
    },
    [createAction, makeMove]
  );

  // Get total points spent in current turn
  const totalPointsSpent = useMemo(() => {
    return pendingActions.reduce((total, action) => total + action.points_spent, 0);
  }, [pendingActions]);

  // Get remaining points for current player
  const remainingPoints = useMemo(() => {
    if (!boardState || !currentTurn) return 0;
    const currentPoints = currentTurn.player_id === 'player1'
      ? boardState.player1_points
      : boardState.player2_points;
    return currentPoints - totalPointsSpent;
  }, [boardState, currentTurn, totalPointsSpent]);

  // Handle square click
  const handleSquareClick = useCallback(
    (squareId: number) => {
      console.log('🎯 handleSquareClick called:', { squareId, isMyTurn, gameStatus });
      if (!isMyTurn || gameStatus !== 'active') return;
      selectSquare(squareId);
      console.log('✅ Square selected:', squareId);
    },
    [isMyTurn, gameStatus, selectSquare]
  );

  // Handle turn submission
  const handleSubmitTurn = useCallback(() => {
    console.log('📤 handleSubmitTurn called:', { canSubmit: canSubmitTurn() });
    if (!canSubmitTurn()) return;
    submitTurn();
    console.log('✅ Turn submitted');
  }, [canSubmitTurn, submitTurn]);

  // Get game status message
  const getStatusMessage = useMemo(() => {
    if (winner) return `Game Over! ${winner} wins!`;
    if (gameStatus === 'waiting') return 'Waiting for game to start...';
    if (!isMyTurn) return "Opponent's turn...";
    if (timeRemaining <= 0) return 'Time is up!';
    return `Your turn - ${timeRemaining}s remaining`;
  }, [winner, gameStatus, isMyTurn, timeRemaining]);

  // Log pending actions changes
  console.log('🔄 useGameActions - pendingActions updated:', pendingActions);

  return {
    // State
    boardState,
    currentTurn,
    pendingActions,
    selectedSquare,
    selectedAction,
    isMyTurn,
    timeRemaining,
    gameStatus,
    winner,
    availableActions,
    totalPointsSpent,
    remainingPoints,
    canSubmitTurn,
    getStatusMessage,

    // Actions
    claimSquare,
    attackSquare,
    defendSquare,
    conquerSquare,
    handleSubmitTurn,
    handleSquareClick,

    // Utilities
    isActionValid,
    createAction,
    removeAction,
    clearAllActions,
  };
}; 