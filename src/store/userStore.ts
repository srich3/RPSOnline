import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { User, UserInsert, UserUpdate } from '../types/database';

interface UserStore {
  profile: User | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchProfile: (userId: string) => Promise<void>;
  updateProfile: (updates: UserUpdate) => Promise<void>;
  updateStats: (gameResult: 'win' | 'loss', ratingChange: number) => Promise<void>;
  resetError: () => void;
}

export const useUserStore = create<UserStore>((set, get) => ({
  profile: null,
  loading: false,
  error: null,

  fetchProfile: async (userId: string) => {
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      set({ profile: null, loading: false, error: 'Invalid user ID for profile fetch.' });
      return;
    }
    set({ loading: true, error: null });

    try {
      const { data, error, status } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // If 406, treat as "no profile found" rather than error
        if (status === 406) {
          set({ profile: null, loading: false });
        } else if (error.code === 'PGRST116' || error.message?.toLowerCase().includes('no rows')) {
          set({ profile: null, loading: false });
        } else {
          set({
            error: error instanceof Error ? error.message : 'Failed to fetch profile',
            loading: false,
          });
        }
      } else {
        set({ profile: data, loading: false });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch profile',
        loading: false,
      });
    }
  },

  updateProfile: async (updates: UserUpdate) => {
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

    const updates: UserUpdate = {
      wins: gameResult === 'win' ? profile.wins + 1 : profile.wins,
      losses: gameResult === 'loss' ? profile.losses + 1 : profile.losses,
      rating: Math.max(0, profile.rating + ratingChange), // Prevent negative rating
    };

    await get().updateProfile(updates);
  },

  resetError: () => {
    set({ error: null });
  }
})); 