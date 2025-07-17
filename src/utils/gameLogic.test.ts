import { describe, it, expect } from 'vitest';
import {
  createInitialBoard,
  isValidMove,
  processPlayerActions,
  checkWinCondition,
  isGameDraw,
  getAvailableActions,
  calculateGameStats,
  GAME_CONSTANTS,
} from './gameLogic';
import { PlayerAction } from '../types/game';

describe('gameLogic', () => {
  it('should initialize a board with 9 empty squares', () => {
    const board = createInitialBoard();
    expect(board.squares).toHaveLength(9);
    expect(board.squares.every(sq => sq.owner === undefined)).toBe(true);
  });

  it('should validate a conquer move on an empty square', () => {
    const board = createInitialBoard();
    const action: PlayerAction = {
      id: '1',
      action_type: 'conquer',
      target_square: 0,
      points_spent: 2,
      timestamp: new Date().toISOString(),
    };
    expect(isValidMove(action, board, 'player1')).toBe(true);
  });

  it('should invalidate a conquer move on a claimed square', () => {
    const board = createInitialBoard();
    board.squares[0].owner = 'player1';
    const action: PlayerAction = {
      id: '2',
      action_type: 'conquer',
      target_square: 0,
      points_spent: 1,
      timestamp: new Date().toISOString(),
    };
    expect(isValidMove(action, board, 'player2')).toBe(false);
  });

  it('should process a conquer action and update the board', () => {
    const board = createInitialBoard();
    const action: PlayerAction = {
      id: '3',
      action_type: 'conquer',
      target_square: 1,
      points_spent: 2,
      timestamp: new Date().toISOString(),
    };
    const newBoard = processPlayerActions([action], board, 'player1');
    expect(newBoard.squares[1].owner).toBe('player1');
    expect(newBoard.player1_points).toBe(GAME_CONSTANTS.MAX_POINTS_PER_TURN - 2);
  });

  it('should detect win condition when a player claims enough squares', () => {
    const board = createInitialBoard();
    for (let i = 0; i < GAME_CONSTANTS.WIN_CONDITION; i++) {
      board.squares[i].owner = 'player1';
    }
    expect(checkWinCondition(board)).toBe('player1');
  });

  it('should detect a draw when all squares are claimed', () => {
    const board = createInitialBoard();
    board.squares.forEach((sq, i) => (sq.owner = i % 2 === 0 ? 'player1' : 'player2'));
    expect(isGameDraw(board)).toBe(true);
  });

  it('should return available actions for a player', () => {
    const board = createInitialBoard();
    board.squares[0].owner = 'player1';
    const actions = getAvailableActions(board, 'player1');
    expect(actions.some(a => a.actionType === 'defend')).toBe(true);
    expect(actions.some(a => a.actionType === 'conquer')).toBe(false);
  });

  it('should calculate game stats correctly', () => {
    const board = createInitialBoard();
    board.squares[0].owner = 'player1';
    board.squares[1].owner = 'player2';
    board.squares[2].is_defended = true;
    const stats = calculateGameStats(board);
    expect(stats.player1Squares).toBe(1);
    expect(stats.player2Squares).toBe(1);
    expect(stats.defendedSquares).toBe(1);
    expect(stats.emptySquares).toBe(7);
  });
});

// Usage Example:
// import { createInitialBoard, processPlayerActions } from './gameLogic';
// const board = createInitialBoard();
// const action: PlayerAction = { ... };
// const newBoard = processPlayerActions([action], board, 'player1'); 