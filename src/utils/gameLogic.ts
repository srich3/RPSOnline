import { GameBoardState, SquareState, PlayerAction, ActionType, GameStatus } from '../types/game';

// Game constants
export const GAME_CONSTANTS = {
  BOARD_SIZE: 9,
  MAX_POINTS_PER_TURN: 10,
  TURN_TIME_LIMIT: 30,
  WIN_CONDITION: 5, // Number of squares needed to win
} as const;

// Initialize a new game board
export const createInitialBoard = (): GameBoardState => {
  const squares: SquareState[] = Array.from({ length: GAME_CONSTANTS.BOARD_SIZE }, (_, i) => ({
    id: i,
    owner: undefined,
    is_defended: false,
    defense_points: 0,
    attack_points: 0,
    conquer_points: 0,
  }));

  return {
    squares,
    player1_points: GAME_CONSTANTS.MAX_POINTS_PER_TURN,
    player2_points: GAME_CONSTANTS.MAX_POINTS_PER_TURN,
    current_turn: {
      player_id: 'player1',
      phase: 'planning',
      time_remaining: GAME_CONSTANTS.TURN_TIME_LIMIT,
      actions: [],
    },
    player1_submitted: false,
    player2_submitted: false,
    turn_start_time: new Date().toISOString(),
  };
};

// Validate if a move is legal
export const isValidMove = (
  action: PlayerAction,
  boardState: GameBoardState,
  currentPlayerId: string
): boolean => {
  console.log('🔍 isValidMove called:', { action, currentPlayerId });
  const { action_type, target_square, points_spent } = action;
  const targetSquare = boardState.squares[target_square];

  if (!targetSquare) {
    console.log('❌ isValidMove - target square not found');
    return false;
  }

  // Check if player has enough points
  const currentPoints = currentPlayerId === 'player1'
    ? boardState.player1_points
    : boardState.player2_points;
  
  console.log('💰 Points check:', { currentPoints, pointsSpent: points_spent, hasEnoughPoints: points_spent <= currentPoints });
  
  if (points_spent > currentPoints) {
    console.log('❌ isValidMove - not enough points');
    return false;
  }

  // Validate based on action type
  switch (action_type) {
    case 'attack':
      // Can attack any square that has an owner (enemy or own)
      const canAttack = !!targetSquare.owner && points_spent >= 1;
      console.log('⚔️ Attack validation:', { 
        hasOwner: !!targetSquare.owner, 
        owner: targetSquare.owner, 
        currentPlayerId, 
        pointsSpent: points_spent, 
        canAttack 
      });
      return canAttack;
    case 'defend':
      // Can defend any square that has an owner (enemy or own)
      const canDefend = !!targetSquare.owner && points_spent >= 1;
      console.log('🛡️ Defend validation:', { 
        owner: targetSquare.owner, 
        currentPlayerId, 
        pointsSpent: points_spent, 
        canDefend 
      });
      return canDefend;
    case 'conquer':
      // Can conquer any square (empty or owned) - will resolve after attacks
      const canConquer = points_spent >= 2;
      console.log('👑 Conquer validation:', { 
        hasOwner: !!targetSquare.owner, 
        owner: targetSquare.owner, 
        currentPlayerId, 
        pointsSpent: points_spent, 
        canConquer 
      });
      return canConquer;
    default:
      console.log('❌ isValidMove - unknown action type:', action_type);
      return false;
  }
};

// Process a player's actions and update the board
export const processPlayerActions = (
  actions: PlayerAction[],
  boardState: GameBoardState,
  playerId: string
): GameBoardState => {
  let newBoardState = { ...boardState };

  // Process actions in order: Defend → Attack → Conquer
  const sortedActions = actions.sort((a, b) => {
    const order: Record<ActionType, number> = { defend: 0, attack: 1, conquer: 2, claim: 3 };
    return order[a.action_type] - order[b.action_type];
  });

  for (const action of sortedActions) {
    if (!isValidMove(action, newBoardState, playerId)) continue;

    const square = newBoardState.squares[action.target_square];
    const newSquare = { ...square };

    switch (action.action_type) {
      case 'claim':
        newSquare.owner = playerId;
        break;
      case 'attack':
        if (newSquare.attack_points > newSquare.defense_points) {
          newSquare.owner = playerId;
          newSquare.is_defended = false;
          newSquare.defense_points = 0;
        }
        newSquare.attack_points += action.points_spent;
        break;
      case 'defend':
        newSquare.is_defended = true;
        newSquare.defense_points += action.points_spent;
        break;
      case 'conquer':
        newSquare.owner = playerId;
        newSquare.is_defended = false;
        newSquare.defense_points = 0;
        newSquare.attack_points = 0;
        break;
    }

    newBoardState.squares[action.target_square] = newSquare;
  }

  // Update player points
  const totalSpent = actions.reduce((sum, action) => sum + action.points_spent, 0);
  if (playerId === 'player1') {
    newBoardState.player1_points -= totalSpent;
  } else {
    newBoardState.player2_points -= totalSpent;
  }

  return newBoardState;
};

// Check if a player has won
export const checkWinCondition = (boardState: GameBoardState): string | null => {
  const player1Squares = boardState.squares.filter(sq => sq.owner === 'player1').length;
  const player2Squares = boardState.squares.filter(sq => sq.owner === 'player2').length;

  if (player1Squares >= GAME_CONSTANTS.WIN_CONDITION) return 'player1';
  if (player2Squares >= GAME_CONSTANTS.WIN_CONDITION) return 'player2';

  return null;
};

// Check if the game is a draw (no more moves possible)
export const isGameDraw = (boardState: GameBoardState): boolean => {
  const allSquaresClaimed = boardState.squares.every(sq => !!sq.owner);
  const noPointsLeft = boardState.player1_points === 0 && boardState.player2_points === 0;

  return allSquaresClaimed || noPointsLeft;
};

// Get available actions for a player
export interface AvailableAction {
  squareId: number;
  actionType: ActionType;
  minPoints: number;
}

export const getAvailableActions = (
  boardState: GameBoardState,
  playerId: string
): AvailableAction[] => {
  const actions: AvailableAction[] = [];

  boardState.squares.forEach((square, index) => {
    if (!square.owner) {
      actions.push({ squareId: index, actionType: 'claim', minPoints: 1 });
    } else if (square.owner === playerId) {
      actions.push({ squareId: index, actionType: 'defend', minPoints: 1 });
    } else {
      actions.push(
        { squareId: index, actionType: 'attack', minPoints: 1 },
        { squareId: index, actionType: 'conquer', minPoints: 2 }
      );
    }
  });

  return actions;
};

// Calculate game statistics
export const calculateGameStats = (boardState: GameBoardState) => {
  const player1Squares = boardState.squares.filter(sq => sq.owner === 'player1').length;
  const player2Squares = boardState.squares.filter(sq => sq.owner === 'player2').length;
  const defendedSquares = boardState.squares.filter(sq => sq.is_defended).length;

  return {
    player1Squares,
    player2Squares,
    defendedSquares,
    emptySquares: GAME_CONSTANTS.BOARD_SIZE - player1Squares - player2Squares,
  };
}; 