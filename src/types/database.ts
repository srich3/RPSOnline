// User Profile
export interface UserProfile {
  id: string;
  username: string;
  wins: number;
  losses: number;
  rating: number;
  created_at: string;
}

// Game State
export interface GameState {
  id: string;
  player1_id: string;
  player2_id: string;
  status: 'waiting' | 'active' | 'finished';
  winner_id?: string | null;
  game_state: any; // JSONB, can be refined later
  turn_number: number;
  current_player: string;
  created_at: string;
}

// Game Move
export interface GameMove {
  id: string;
  game_id: string;
  player_id: string;
  turn_number: number;
  action_type: 'claim' | 'attack' | 'defend' | 'conquer';
  target_square: number;
  points_spent: number;
  created_at: string;
}

// Tournament
export interface Tournament {
  id: string;
  name: string;
  status: 'upcoming' | 'active' | 'finished';
  created_at: string;
}

// Cosmetics
export interface Cosmetic {
  id: string;
  name: string;
  type: string;
  price: number;
  created_at: string;
} 