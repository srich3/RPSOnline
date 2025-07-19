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
      console.log('🔍 Fetching user profile for:', userId);
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (error) {
        console.error('❌ Error fetching user profile:', error);
        console.error('❌ Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        setProfile(null);
      } else {
        console.log('✅ User profile fetched successfully:', data);
        setProfile(data);
      }
    } catch (error) {
      console.error('❌ Exception in fetchUserProfile:', error);
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
    if (!user || !user.id) {
      console.log('No valid user provided to ensureUserProfile');
      return;
    }

    try {
      console.log('🔍 Checking if profile exists for user:', user.id);
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') {
        console.error('❌ Error checking user profile:', error);
        console.error('❌ Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        return;
      }
      
      if (!data) {
        // No profile exists, create one with default values
        console.log('📝 Creating default user profile for:', user.id);
        
        // Generate a simple unique username using timestamp and user ID
        const timestamp = Date.now();
        const userIdSuffix = user.id.slice(0, 8);
        const finalUsername = `user_${userIdSuffix}_${timestamp}`;
        
        console.log('🔤 Generated temporary username for OAuth user:', finalUsername);
        
        const { error: insertError } = await supabase.from('users').insert({
          id: user.id,
          username: finalUsername,
          wins: 0,
          losses: 0,
          rating: 100,
          tutorial_complete: false,
          created_at: new Date().toISOString(),
        });
        
        if (insertError) {
          // If insert fails due to duplicate key, profile already exists
          if (insertError.code === '23505') {
            console.log('✅ Profile already exists for user:', user.id);
          } else {
            console.error('❌ Error creating default profile:', insertError);
            console.error('❌ Insert error details:', {
              code: insertError.code,
              message: insertError.message,
              details: insertError.details,
              hint: insertError.hint
            });
          }
        } else {
          console.log('✅ Successfully created profile with username:', finalUsername);
        }
      } else {
        console.log('✅ Profile already exists for user:', user.id);
      }
    } catch (err) {
      console.error('❌ Exception in ensureUserProfile:', err);
    }
  };

  useEffect(() => {
    let isMounted = true;
    
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      
      console.log('Auth state changed:', _event, session?.user?.id);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        try {
          // For OAuth signups, we need to ensure they go through the landing page
          if (_event === 'SIGNED_IN' && session.user.app_metadata?.provider) {
            console.log('OAuth user signed in, ensuring they go through landing page');
            // Force redirect to landing page for OAuth users
            if (typeof window !== 'undefined' && window.location.pathname !== '/landing') {
              window.location.href = '/landing';
              return;
            }
          }
          
          // Ensure profile exists for all users
          await ensureUserProfile(session.user);
          if (isMounted) {
            await fetchUserProfile(session.user.id);
          }
        } catch (error) {
          console.error('Error in auth state change handler:', error);
        }
      } else {
        setProfile(null);
      }
      
      if (isMounted) {
        setLoading(false);
      }
    });

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;
      
      console.log('Initial session check:', session?.user?.id);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        try {
          await ensureUserProfile(session.user);
          if (isMounted) {
            await fetchUserProfile(session.user.id);
          }
        } catch (error) {
          console.error('Error in initial session handler:', error);
        }
      }
      
      if (isMounted) {
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
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