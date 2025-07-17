import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface UserProfile {
  id: string;
  username: string;
  email: string;
  wins: number;
  losses: number;
  rating: number;
  total_games: number;
  created_at: string;
  updated_at: string;
}

interface UserStore {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchProfile: (userId: string) => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  updateStats: (gameResult: 'win' | 'loss', ratingChange: number) => Promise<void>;
  resetError: () => void;
}

export const useUserStore = create<UserStore>((set, get) => ({
  profile: null,
  loading: false,
  error: null,

  fetchProfile: async (userId: string) => {
    set({ loading: true, error: null });
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        throw error;
      }

      set({ profile: data, loading: false });
    } catch (error) {
      console.error('Error fetching profile:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch profile',
        loading: false 
      });
    }
  },

  updateProfile: async (updates: Partial<UserProfile>) => {
    const { profile } = get();
    if (!profile) return;

    set({ loading: true, error: null });

    try {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', profile.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      set({ profile: data, loading: false });
    } catch (error) {
      console.error('Error updating profile:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update profile',
        loading: false 
      });
    }
  },

  updateStats: async (gameResult: 'win' | 'loss', ratingChange: number) => {
    const { profile } = get();
    if (!profile) return;

    const updates = {
      wins: gameResult === 'win' ? profile.wins + 1 : profile.wins,
      losses: gameResult === 'loss' ? profile.losses + 1 : profile.losses,
      total_games: profile.total_games + 1,
      rating: Math.max(0, profile.rating + ratingChange), // Prevent negative rating
      updated_at: new Date().toISOString()
    };

    await get().updateProfile(updates);
  },

  resetError: () => {
    set({ error: null });
  }
})); 