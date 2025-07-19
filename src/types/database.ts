// Supabase Database Schema Types
// Generated from actual database migrations

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          username: string
          wins: number
          losses: number
          rating: number
          created_at: string
          tutorial_complete: boolean
        }
        Insert: {
          id: string
          username: string
          wins?: number
          losses?: number
          rating?: number
          created_at?: string
          tutorial_complete?: boolean
        }
        Update: {
          id?: string
          username?: string
          wins?: number
          losses?: number
          rating?: number
          created_at?: string
          tutorial_complete?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "users_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      games: {
        Row: {
          id: string
          player1_id: string
          player2_id: string | null
          status: 'waiting' | 'active' | 'finished'
          winner_id: string | null
          game_state: Json
          turn_number: number
          current_player: string | null
          created_at: string
          updated_at: string
          player1_accepted: boolean
          player2_accepted: boolean
        }
        Insert: {
          id?: string
          player1_id: string
          player2_id?: string | null
          status?: 'waiting' | 'active' | 'finished'
          winner_id?: string | null
          game_state?: Json
          turn_number?: number
          current_player?: string | null
          created_at?: string
          updated_at?: string
          player1_accepted?: boolean
          player2_accepted?: boolean
        }
        Update: {
          id?: string
          player1_id?: string
          player2_id?: string | null
          status?: 'waiting' | 'active' | 'finished'
          winner_id?: string | null
          game_state?: Json
          turn_number?: number
          current_player?: string | null
          created_at?: string
          updated_at?: string
          player1_accepted?: boolean
          player2_accepted?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "games_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_current_player_fkey"
            columns: ["current_player"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      game_moves: {
        Row: {
          id: string
          game_id: string
          player_id: string
          turn_number: number
          action_type: 'claim' | 'attack' | 'defend' | 'conquer'
          target_square: number
          points_spent: number
          created_at: string
        }
        Insert: {
          id?: string
          game_id: string
          player_id: string
          turn_number: number
          action_type: 'claim' | 'attack' | 'defend' | 'conquer'
          target_square: number
          points_spent: number
          created_at?: string
        }
        Update: {
          id?: string
          game_id?: string
          player_id?: string
          turn_number?: number
          action_type?: 'claim' | 'attack' | 'defend' | 'conquer'
          target_square?: number
          points_spent?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_moves_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_moves_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      game_queue: {
        Row: {
          id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Convenience types for common operations
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Inserts<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type Updates<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

// Specific table types
export type User = Tables<'users'>
export type UserInsert = Inserts<'users'>
export type UserUpdate = Updates<'users'>

export type Game = Tables<'games'>
export type GameInsert = Inserts<'games'>
export type GameUpdate = Updates<'games'>

export type GameMove = Tables<'game_moves'>
export type GameMoveInsert = Inserts<'game_moves'>
export type GameMoveUpdate = Updates<'game_moves'>

export type GameQueue = Tables<'game_queue'>
export type GameQueueInsert = Inserts<'game_queue'>
export type GameQueueUpdate = Updates<'game_queue'>

// Legacy types for backward compatibility
export interface UserProfile {
  id: string;
  username: string;
  wins: number;
  losses: number;
  rating: number;
  created_at: string;
  tutorial_complete: boolean;
}

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

export interface Tournament {
  id: string;
  name: string;
  status: 'upcoming' | 'active' | 'finished';
  created_at: string;
}

export interface Cosmetic {
  id: string;
  name: string;
  type: string;
  price: number;
  created_at: string;
} 