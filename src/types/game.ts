export type GameStatus = 'waiting' | 'active' | 'finished';
export type TurnPhase = 'planning' | 'resolving' | 'complete';
export type ActionType = 'claim' | 'attack' | 'defend' | 'conquer';

export interface GameState {
  id: string;
  player1_id: string;
  player2_id: string;
  status: GameStatus;
  winner_id?: string;
  game_state: GameBoardState;
  turn_number: number;
  created_at: string;
}

export interface GameBoardState {
  squares: SquareState[];
  player1_points: number;
  player2_points: number;
  current_turn: PlayerTurn;
  // Track submission status for both players
  player1_submitted: boolean;
  player2_submitted: boolean;
  turn_start_time: string; // ISO timestamp when turn started
}

export interface SquareState {
  id: number;
  owner?: string; // player1_id or player2_id
  is_defended: boolean;
  defense_points: number;
  attack_points: number;
  conquer_points: number;
}

export interface PlayerTurn {
  player_id: string;
  phase: TurnPhase;
  time_remaining: number;
  actions: PlayerAction[];
}

export interface PlayerAction {
  id: string;
  action_type: ActionType;
  target_square: number;
  points_spent: number;
  timestamp: string;
}

export interface GameMove {
  id: string;
  game_id: string;
  player_id: string;
  turn_number: number;
  action_type: ActionType;
  target_square: number;
  points_spent: number;
  created_at: string;
}

export interface GamePlayer {
  id: string;
  username: string;
  rating: number;
  wins: number;
  losses: number;
}

export interface GameResult {
  winner_id: string;
  loser_id: string;
  final_score: {
    player1: number;
    player2: number;
  };
  game_duration: number;
  moves_count: number;
} 