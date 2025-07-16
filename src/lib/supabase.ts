import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Placeholder for DB types (import from src/types/database later)
// import type { Database } from '@/types/database';

// Auth helpers
export const signInWithEmail = (email: string, password: string) =>
  supabase.auth.signInWithPassword({ email, password });

export const signUpWithEmail = (email: string, password: string) =>
  supabase.auth.signUp({ email, password });

export const signOut = () => supabase.auth.signOut();

// Real-time subscription helper (example)
export const subscribeToTable = (table: string, callback: (payload: any) => void) => {
  return supabase.channel(table)
    .on('postgres_changes', { event: '*', schema: 'public', table }, callback)
    .subscribe();
}; 