import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  GameState,
  GameBoardState,
  PlayerAction,
  PlayerTurn,
  TurnPhase,
  GameStatus,
  GameMove,
} from '../types/game';
import {
  createInitialBoard,
  processPlayerActions,
  checkWinCondition,
  isGameDraw,
  getAvailableActions,
  calculateGameStats,
  GAME_CONSTANTS,
} from '../utils/gameLogic';

interface GameStore {
  // Game state
  currentGame: GameState | null;
  boardState: GameBoardState | null;
  gameStatus: GameStatus;
  winner: string | null;
  
  // Turn management
  currentTurn: PlayerTurn | null;
  timeRemaining: number;
  isMyTurn: boolean;
  
  // Player actions
  pendingActions: PlayerAction[];
  selectedSquare: number | null;
  selectedAction: string | null;
  
  // Game history
  gameHistory: GameMove[];
  moveCount: number;
  
  // Actions
  startNewGame: (player1Id: string, player2Id: string) => void;
  makeMove: (action: PlayerAction) => void;
  selectSquare: (squareId: number) => void;
  selectAction: (actionType: string) => void;
  addPointsToAction: (squareId: number, actionType: string, points: number) => void;
  submitTurn: () => void;
  endTurn: () => void;
  updateTimeRemaining: (time: number) => void;
  resetGame: () => void;
  removeAction: (actionId: string) => void;
  clearAllActions: () => void;
  resolveTurn: () => void;
  
  // Computed values
  getAvailableActions: () => ReturnType<typeof getAvailableActions>;
  getGameStats: () => ReturnType<typeof calculateGameStats>;
  canSubmitTurn: () => boolean;
}

export const useGameStore = create<GameStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      currentGame: null,
      boardState: null,
      gameStatus: 'waiting',
      winner: null,
      currentTurn: null,
      timeRemaining: GAME_CONSTANTS.TURN_TIME_LIMIT,
      isMyTurn: false,
      pendingActions: [],
      selectedSquare: null,
      selectedAction: null,
      gameHistory: [],
      moveCount: 0,

      // Actions
      startNewGame: (player1Id: string, player2Id: string) => {
        const initialBoard = createInitialBoard();
        const newGame: GameState = {
          id: crypto.randomUUID(),
          player1_id: player1Id,
          player2_id: player2Id,
          status: 'active',
          game_state: initialBoard,
          turn_number: 1,
          current_player: player1Id,
          created_at: new Date().toISOString(),
        };

        set({
          currentGame: newGame,
          boardState: initialBoard,
          gameStatus: 'active',
          winner: null,
          currentTurn: initialBoard.current_turn,
          timeRemaining: GAME_CONSTANTS.TURN_TIME_LIMIT,
          isMyTurn: true, // Assuming current user is player1 for now
          pendingActions: [],
          selectedSquare: null,
          selectedAction: null,
          gameHistory: [],
          moveCount: 0,
        });
      },

      makeMove: (action: PlayerAction) => {
        console.log('🏪 makeMove called in store:', action);
        const { boardState, currentTurn } = get();
        if (!boardState || !currentTurn) {
          console.log('❌ makeMove - no boardState or currentTurn');
          return;
        }

        // Add action to pending actions
        set((state) => {
          const newPendingActions = [...state.pendingActions, action];
          console.log('✅ makeMove - action added to pendingActions:', newPendingActions);
          return {
            pendingActions: newPendingActions,
          };
        });
      },

      removeAction: (actionId: string) => {
        console.log('🗑️ removeAction called in store:', actionId);
        set((state) => {
          const newPendingActions = state.pendingActions.filter(action => action.id !== actionId);
          console.log('✅ removeAction - action removed from pendingActions:', newPendingActions);
          return {
            pendingActions: newPendingActions,
          };
        });
      },

      clearAllActions: () => {
        console.log('🗑️ clearAllActions called in store');
        set({
          pendingActions: [],
        });
        console.log('✅ clearAllActions - all pending actions cleared');
      },

      selectSquare: (squareId: number) => {
        set({ selectedSquare: squareId });
      },

      selectAction: (actionType: string) => {
        set({ selectedAction: actionType });
      },

      addPointsToAction: (squareId: number, actionType: string, points: number) => {
        const { pendingActions, currentTurn } = get();
        if (!currentTurn) return;

        const newAction: PlayerAction = {
          id: crypto.randomUUID(),
          action_type: actionType as any,
          target_square: squareId,
          points_spent: points,
          timestamp: new Date().toISOString(),
        };

        set({
          pendingActions: [...pendingActions, newAction],
        });
      },

      submitTurn: () => {
        const { boardState, currentTurn, pendingActions, currentGame } = get();
        if (!boardState || !currentTurn) return;

        // Determine which player is submitting
        const isPlayer1 = currentTurn.player_id === currentGame?.player1_id;
        const isPlayer2 = currentTurn.player_id === currentGame?.player2_id;

        // Mark this player as submitted
        let newBoardState = { ...boardState };
        if (isPlayer1) newBoardState.player1_submitted = true;
        if (isPlayer2) newBoardState.player2_submitted = true;

        // Process actions for this player
        if (pendingActions.length > 0) {
          newBoardState = processPlayerActions(
            pendingActions,
            newBoardState,
            currentTurn.player_id
          );
        }

        // Clear pending actions for this player
        set((state) => ({
          boardState: newBoardState,
          pendingActions: [],
          selectedSquare: null,
          selectedAction: null,
          gameHistory: [
            ...state.gameHistory,
            ...pendingActions.map((action) => ({
              id: action.id,
              game_id: state.currentGame?.id || '',
              player_id: currentTurn.player_id,
              turn_number: state.currentGame?.turn_number || 1,
              action_type: action.action_type,
              target_square: action.target_square,
              points_spent: action.points_spent,
              created_at: action.timestamp,
            })),
          ],
          moveCount: state.moveCount + pendingActions.length,
        }));

        // If both players have submitted, resolve the turn
        if (newBoardState.player1_submitted && newBoardState.player2_submitted) {
          get().resolveTurn();
        }
      },

      endTurn: () => {
        const { currentGame, boardState } = get();
        if (!currentGame || !boardState) return;

        const nextPlayer = currentGame.current_player === currentGame.player1_id
          ? currentGame.player2_id
          : currentGame.player1_id;

        const nextTurn: PlayerTurn = {
          player_id: nextPlayer,
          phase: 'planning',
          time_remaining: GAME_CONSTANTS.TURN_TIME_LIMIT,
          actions: [],
        };

        set((state) => ({
          currentTurn: nextTurn,
          timeRemaining: GAME_CONSTANTS.TURN_TIME_LIMIT,
          isMyTurn: nextPlayer === currentGame.player1_id, // This should be based on current user
          currentGame: state.currentGame ? {
            ...state.currentGame,
            current_player: nextPlayer,
            turn_number: (state.currentGame.turn_number || 1) + 1,
          } : null,
        }));
      },

      updateTimeRemaining: (time: number) => {
        set({ timeRemaining: time });

        // If time runs out, auto-submit for any player who hasn't submitted
        const { boardState, currentTurn, currentGame } = get();
        if (!boardState || !currentTurn || !currentGame) return;
        if (time <= 0) {
          // Auto-submit for player 1 if not submitted
          if (!boardState.player1_submitted) {
            setTimeout(() => {
              set((state) => ({
                boardState: { ...state.boardState!, player1_submitted: true },
              }));
            }, 0);
          }
          // Auto-submit for player 2 if not submitted
          if (!boardState.player2_submitted) {
            setTimeout(() => {
              set((state) => ({
                boardState: { ...state.boardState!, player2_submitted: true },
              }));
            }, 0);
          }
          // After both are marked submitted, resolve the turn
          setTimeout(() => {
            const { boardState } = get();
            if (boardState?.player1_submitted && boardState?.player2_submitted) {
              get().resolveTurn();
            }
          }, 10);
        }
      },

      resetGame: () => {
        set({
          currentGame: null,
          boardState: null,
          gameStatus: 'waiting',
          winner: null,
          currentTurn: null,
          timeRemaining: GAME_CONSTANTS.TURN_TIME_LIMIT,
          isMyTurn: false,
          pendingActions: [],
          selectedSquare: null,
          selectedAction: null,
          gameHistory: [],
          moveCount: 0,
        });
      },

      // Computed values
      getAvailableActions: () => {
        const { boardState, currentTurn } = get();
        if (!boardState || !currentTurn) return [];
        return getAvailableActions(boardState, currentTurn.player_id);
      },

      getGameStats: () => {
        const { boardState } = get();
        if (!boardState) return null;
        return calculateGameStats(boardState);
      },

      canSubmitTurn: () => {
        const { pendingActions, currentTurn } = get();
        return pendingActions.length > 0 && currentTurn?.phase === 'planning';
      },

      resolveTurn: () => {
        const { boardState, currentGame } = get();
        if (!boardState || !currentGame) return;

        // Check for win/draw
        const winner = checkWinCondition(boardState);
        const isDraw = isGameDraw(boardState);

        // Prepare for next turn or finish game
        if (winner || isDraw) {
          set({
            gameStatus: 'finished',
            winner: winner || null,
          });
          return;
        }

        // Reset for next turn
        const nextTurnNumber = (currentGame.turn_number || 1) + 1;
        const nextPlayer = currentGame.current_player === currentGame.player1_id
          ? currentGame.player2_id
          : currentGame.player1_id;
        const newTurn: PlayerTurn = {
          player_id: nextPlayer,
          phase: 'planning',
          time_remaining: GAME_CONSTANTS.TURN_TIME_LIMIT,
          actions: [],
        };
        set((state) => ({
          currentTurn: newTurn,
          timeRemaining: GAME_CONSTANTS.TURN_TIME_LIMIT,
          isMyTurn: nextPlayer === currentGame.player1_id, // Should be based on current user
          currentGame: state.currentGame ? {
            ...state.currentGame,
            current_player: nextPlayer,
            turn_number: nextTurnNumber,
          } : null,
          boardState: {
            ...state.boardState!,
            player1_submitted: false,
            player2_submitted: false,
            turn_start_time: new Date().toISOString(),
          },
        }));
      },
    }),
    {
      name: 'game-store',
    }
  )
); 