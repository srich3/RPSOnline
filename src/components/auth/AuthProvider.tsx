'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
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
  
  // Track if we've already processed a user to prevent duplicate calls
  const processedUsers = useRef<Set<string>>(new Set());
  const hasInitialized = useRef<boolean>(false);
  const initializationPromise = useRef<Promise<void> | null>(null);
  
  // Get store clear functions
  const clearUserData = useUserStore(state => state.clearUserData);
  const clearGameData = useGameStore(state => state.clearGameData);

  // Memoized fetch user profile function
  const fetchUserProfile = useCallback(async (userId: string) => {
    try {
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
        setProfile(data);
      }
    } catch (error) {
      console.error('❌ Exception in fetchUserProfile:', error);
      setProfile(null);
    }
  }, []);

  // Refresh profile function for external use
  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchUserProfile(user.id);
    }
  }, [user, fetchUserProfile]);

  // Memoized helper to ensure a users row exists for every auth user
  const ensureUserProfile = useCallback(async (user: User) => {
    if (!user || !user.id) {
      return;
    }

    // Check if we've already processed this user in this session
    if (processedUsers.current.has(user.id)) {
      return;
    }

    // Check if we've already initialized for this user
    if (hasInitialized.current) {
      return;
    }

    try {
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
        const timestamp = Date.now();
        const userIdSuffix = user.id.slice(0, 8);
        const finalUsername = `user_${userIdSuffix}_${timestamp}`;
        
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
        }
      }
      
      // Mark this user as processed
      processedUsers.current.add(user.id);
    } catch (err) {
      console.error('❌ Exception in ensureUserProfile:', err);
    }
  }, []);

  // Memoized function to handle user initialization
  const initializeUser = useCallback(async (sessionUser: User, event?: string) => {
    if (!sessionUser || !sessionUser.id) return;

    // If we're already initializing, wait for that to complete
    if (initializationPromise.current) {
      await initializationPromise.current;
      return;
    }

    // If already initialized, skip
    if (hasInitialized.current) {
      return;
    }

    // Create a new initialization promise
    initializationPromise.current = (async () => {
      try {
        // For OAuth signups, we need to ensure they go through the landing page
        if (event === 'SIGNED_IN' && sessionUser.app_metadata?.provider) {
          console.log('OAuth user signed in, ensuring they go through landing page');
          // Force redirect to landing page for OAuth users
          if (typeof window !== 'undefined' && window.location.pathname !== '/landing') {
            window.location.href = '/landing';
            return;
          }
        }
        
        // Ensure profile exists for all users
        await ensureUserProfile(sessionUser);
        await fetchUserProfile(sessionUser.id);
        
        hasInitialized.current = true;
      } catch (error) {
        console.error('❌ Error during initialization:', error);
        throw error;
      } finally {
        // Clear the promise reference
        initializationPromise.current = null;
      }
    })();

    // Wait for the initialization to complete
    await initializationPromise.current;
  }, [ensureUserProfile, fetchUserProfile]);

  useEffect(() => {
    let isMounted = true;
    
          const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!isMounted) return;
        
        console.log('Auth state changed:', event, session?.user?.id);
        setUser(session?.user ?? null);
      
      if (session?.user) {
        try {
          await initializeUser(session.user, event);
        } catch (error) {
          console.error('Error in auth state change handler:', error);
        }
      } else {
        setProfile(null);
        // Clear processed users when user signs out
        processedUsers.current.clear();
        hasInitialized.current = false;
        initializationPromise.current = null;
      }
      
      if (isMounted) {
        setLoading(false);
      }
    });

    // Get initial session
          supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (!isMounted) {
          return;
        }
        
        console.log('Initial session check:', session?.user?.id);
        setUser(session?.user ?? null);
      
      if (session?.user) {
        try {
          await initializeUser(session.user);
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
      // Clean up processed users on unmount
      processedUsers.current.clear();
      hasInitialized.current = false;
      initializationPromise.current = null;
    };
  }, [initializeUser]);

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