'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, AuthError, AuthResponse, OAuthResponse } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/database';
import { useUserStore } from '../../store/userStore';
import { useGameStore } from '../../store/gameStore';

type UserProfile = Database['public']['Tables']['users']['Row'];

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResponse>;
  signUp: (email: string, password: string) => Promise<AuthResponse>;
  signOut: () => Promise<{ error: AuthError | null }>;
  signInWithProvider: (provider: 'google' | 'github') => Promise<OAuthResponse>;
  updateProfile: (updates: Database['public']['Tables']['users']['Update']) => Promise<{ data: UserProfile | null; error: AuthError | null }>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Get store clear functions
  const clearUserData = useUserStore(state => state.clearUserData);
  const clearGameData = useGameStore(state => state.clearGameData);

  // Fetch user profile when user changes
  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching user profile:', error);
        setProfile(null);
      } else {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setProfile(null);
    }
  };

  // Refresh profile function for external use
  const refreshProfile = async () => {
    if (user) {
      await fetchUserProfile(user.id);
    }
  };

  // Helper to ensure a users row exists for every auth user
  const ensureUserProfile = async (user: User) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      
      if (!data && error?.code !== 'PGRST116') {
        console.error('Error checking user profile:', error);
        return;
      }
      
      if (!data) {
        // No profile exists, create one with default values
        console.log('Creating default user profile for:', user.id);
        const { error: insertError } = await supabase.from('users').insert({
          id: user.id,
          username: '', // Empty username - user will set this later
          wins: 0,
          losses: 0,
          rating: 1000,
          tutorial_complete: false,
          created_at: new Date().toISOString(),
        });
        
        if (insertError) {
          // If insert fails due to duplicate key, profile already exists
          if (insertError.code === '23505') {
            console.log('Profile already exists for user:', user.id);
          } else {
            console.error('Error creating default profile:', insertError);
          }
        }
      }
    } catch (err) {
      console.error('Exception in ensureUserProfile:', err);
    }
  };

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        // Ensure profile exists for all users
        await ensureUserProfile(session.user);
        await fetchUserProfile(session.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await ensureUserProfile(session.user);
        await fetchUserProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = (email: string, password: string) => 
    supabase.auth.signInWithPassword({ email, password });
    
  const signUp = (email: string, password: string) => 
    supabase.auth.signUp({ email, password });
    
  const signOutUser = async () => {
    try {
      console.log('Starting comprehensive logout...');
      
      // Clear all Supabase auth data
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Error during Supabase signOut:', error);
      }
      
      // Clear local state
      setUser(null);
      setProfile(null);
      
      // Clear all store data
      clearUserData();
      clearGameData();
      
      // Clear localStorage and sessionStorage
      if (typeof window !== 'undefined') {
        // Clear all localStorage items
        localStorage.clear();
        
        // Clear all sessionStorage items
        sessionStorage.clear();
        
        // Clear any cookies that might be set
        document.cookie.split(";").forEach((c) => {
          document.cookie = c
            .replace(/^ +/, "")
            .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });
        
        console.log('All local storage and cookies cleared');
      }
      
      // Force a hard refresh to clear any cached data
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
      
      return { error: null };
    } catch (err) {
      console.error('Error during logout:', err);
      return { error: err as AuthError };
    }
  };

  const signInWithProvider = (provider: 'google' | 'github') => {
    return supabase.auth.signInWithOAuth({ 
      provider,
      options: {
        redirectTo: `${window.location.origin}/landing`
      }
    });
  };

  const updateProfile = async (updates: Database['public']['Tables']['users']['Update']) => {
    if (!user) throw new Error('No user logged in');
    
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    setProfile(data);
    return { data, error };
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile,
      loading, 
      signIn, 
      signUp, 
      signOut: signOutUser,
      signInWithProvider,
      updateProfile,
      refreshProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
}; 