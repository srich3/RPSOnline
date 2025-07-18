// Main Supabase client and core helpers
export { supabase } from './supabase';
export * from './supabase';

// Database utilities and transformations
export * from './databaseUtils';

// Re-export types for convenience
export type { Database } from '../types/database';
export type { User, Game, GameMove, UserInsert, GameInsert, GameMoveInsert } from '../types/database'; 