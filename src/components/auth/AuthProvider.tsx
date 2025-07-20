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
  
  // Performance optimizations
  const processedUsers = useRef<Set<string>>(new Set());
  const profileCache = useRef<Map<string, UserProfile>>(new Map());
  const initializationPromise = useRef<Promise<void> | null>(null);
  
  // Get store clear functions
  const clearUserData = useUserStore(state => state.clearUserData);
  const clearGameData = useGameStore(state => state.clearGameData);

  // Optimized function to get or create user profile in a single operation
  const getOrCreateUserProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    // Check cache first
    if (profileCache.current.has(userId)) {
      return profileCache.current.get(userId) || null;
    }

    // Check if we've already processed this user
    if (processedUsers.current.has(userId)) {
      return null; // Already processed, profile should be set
    }

    try {
      // Try to get existing profile
      const { data: existingProfile, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('❌ Error fetching user profile:', fetchError);
        return null;
      }
      
      if (existingProfile) {
        // Cache the profile
        profileCache.current.set(userId, existingProfile);
        processedUsers.current.add(userId);
        return existingProfile;
      }
      
      // Profile doesn't exist, create one
      const timestamp = Date.now();
      const userIdSuffix = userId.slice(0, 8);
      const finalUsername = `user_${userIdSuffix}_${timestamp}`;
      
      const { data: newProfile, error: insertError } = await supabase
        .from('users')
        .insert({
          id: userId,
          username: finalUsername,
          wins: 0,
          losses: 0,
          rating: 100,
          tutorial_complete: false,
          total_games_played: 0,
          games_won: 0,
          games_lost: 0,
          games_forfeited: 0,
          games_canceled: 0,
          opponents_forfeited: 0,
          opponents_canceled: 0,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (insertError) {
        if (insertError.code === '23505') {
          // Duplicate key, profile was created by another process
          // Try to fetch it again
          const { data: retryProfile } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
          
          if (retryProfile) {
            profileCache.current.set(userId, retryProfile);
            processedUsers.current.add(userId);
            return retryProfile;
          }
        } else {
          console.error('❌ Error creating user profile:', insertError);
          return null;
        }
      } else if (newProfile) {
        // Cache the new profile
        profileCache.current.set(userId, newProfile);
        processedUsers.current.add(userId);
        return newProfile;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Exception in getOrCreateUserProfile:', error);
      return null;
    }
  }, []);

  // Optimized user initialization
  const initializeUser = useCallback(async (sessionUser: User, event?: string) => {
    if (!sessionUser?.id) return;

    // If we're already initializing, wait for that to complete
    if (initializationPromise.current) {
      await initializationPromise.current;
      return;
    }

    // Create a new initialization promise
    initializationPromise.current = (async () => {
      try {
        // For OAuth signups, ensure they go through landing page
        if (event === 'SIGNED_IN' && sessionUser.app_metadata?.provider) {
          console.log('OAuth user signed in, ensuring they go through landing page');
          // Don't force redirect here - let the landing page handle it
          // This was causing issues with the initialization flow
        }
        
        // Get or create profile in a single operation
        const userProfile = await getOrCreateUserProfile(sessionUser.id);
        setProfile(userProfile);
        
      } catch (error) {
        console.error('❌ Error during user initialization:', error);
        setProfile(null);
      } finally {
        // Clear the promise reference
        initializationPromise.current = null;
      }
    })();

    // Wait for the initialization to complete
    await initializationPromise.current;
  }, [getOrCreateUserProfile]);

  // Refresh profile function
  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      // Clear cache and fetch fresh data
      profileCache.current.delete(user.id);
      processedUsers.current.delete(user.id);
      const freshProfile = await getOrCreateUserProfile(user.id);
      setProfile(freshProfile);
    }
  }, [user, getOrCreateUserProfile]);

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
          setProfile(null);
        }
      } else {
        setProfile(null);
        // Clear caches when user signs out
        processedUsers.current.clear();
        profileCache.current.clear();
        initializationPromise.current = null;
      }
      
      if (isMounted) {
        setLoading(false);
      }
    });

    // Get initial session with timeout
    const initializeSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        console.log('Initial session check:', session?.user?.id);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await initializeUser(session.user);
        }
      } catch (error) {
        console.error('Error in initial session handler:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (isMounted && loading) {
        console.log('Auth initialization timeout, setting loading to false');
        setLoading(false);
      }
    }, 8000); // Reduced from 10 seconds to 8 seconds for faster fallback

    initializeSession();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      listener.subscription.unsubscribe();
      // Clean up caches on unmount
      processedUsers.current.clear();
      profileCache.current.clear();
      initializationPromise.current = null;
    };
  }, [initializeUser, loading]);

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
      
      // Clear caches
      processedUsers.current.clear();
      profileCache.current.clear();
      initializationPromise.current = null;
      
      // Clear localStorage and sessionStorage
      if (typeof window !== 'undefined') {
        localStorage.clear();
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
        redirectTo: `${window.location.origin}/landing`,
        queryParams: {
          // Add a flag to indicate this is an OAuth sign-in
          oauth: 'true'
        }
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
    
    // Update cache
    if (data) {
      profileCache.current.set(user.id, data);
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