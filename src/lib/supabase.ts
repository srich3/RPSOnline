import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Auth helpers
export const signInWithEmail = (email: string, password: string) =>
  supabase.auth.signInWithPassword({ email, password });

export const signUpWithEmail = (email: string, password: string) =>
  supabase.auth.signUp({ email, password });

export const signOut = () => supabase.auth.signOut();

export const signInWithProvider = (provider: 'google' | 'github') => {
  return supabase.auth.signInWithOAuth({ 
    provider,
    options: {
      redirectTo: `${window.location.origin}/dashboard`
    }
  });
};

// Real-time subscription helper (example)
export const subscribeToTable = (table: string, callback: (payload: any) => void) => {
  return supabase.channel(table)
    .on('postgres_changes', { event: '*', schema: 'public', table }, callback)
    .subscribe();
};

// Insert user profile into users table
export const createUserProfile = async (userData: Database['public']['Tables']['users']['Insert']) => {
  return supabase.from('users').insert([userData]);
};

// Example typed helper functions
export const getUserById = async (userId: string) => {
  return supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
};

export const createGame = async (gameData: Database['public']['Tables']['games']['Insert']) => {
  return supabase
    .from('games')
    .insert([gameData])
    .select()
    .single();
};

export const getGamesByPlayer = async (playerId: string) => {
  return supabase
    .from('games')
    .select(`
      *,
      player1:users!games_player1_id_fkey(username),
      player2:users!games_player2_id_fkey(username)
    `)
    .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
    .order('created_at', { ascending: false });
};

export const addGameMove = async (moveData: Database['public']['Tables']['game_moves']['Insert']) => {
  return supabase
    .from('game_moves')
    .insert([moveData])
    .select()
    .single();
}; 