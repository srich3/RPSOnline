import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../components/auth/AuthProvider';
import { statsManager, type UserStats, type GameResult, type GameAction } from '../utils/statsManager';

interface UseUserStatsReturn {
  // Stats
  stats: UserStats | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  trackAction: (actionType: 'attack' | 'defend' | 'conquer', successful: boolean) => void;
  recordGameResult: (result: GameResult) => void;
  saveStats: () => Promise<boolean>;
  refreshStats: () => Promise<void>;
}

export const useUserStats = (): UseUserStatsReturn => {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize stats manager
  const initializeStats = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);
      
      const userStats = await statsManager.initialize(user.id);
      setStats(userStats);
    } catch (err) {
      console.error('Error initializing stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Track an action (local only)
  const trackAction = useCallback((actionType: 'attack' | 'defend' | 'conquer', successful: boolean) => {
    statsManager.trackAction(actionType, successful);
    
    // Update local state
    const currentStats = statsManager.getStats();
    if (currentStats) {
      setStats({ ...currentStats });
    }
  }, []);

  // Record game result (local only)
  const recordGameResult = useCallback((result: GameResult) => {
    statsManager.recordGameResult(result);
    
    // Update local state
    const currentStats = statsManager.getStats();
    if (currentStats) {
      setStats({ ...currentStats });
    }
  }, []);

  // Save stats to database
  const saveStats = useCallback(async (): Promise<boolean> => {
    try {
      const success = await statsManager.saveStats();
      if (success) {
        // Refresh stats from database
        await initializeStats();
      }
      return success;
    } catch (err) {
      console.error('Error saving stats:', err);
      return false;
    }
  }, [initializeStats]);

  // Refresh stats from database
  const refreshStats = useCallback(async () => {
    await initializeStats();
  }, [initializeStats]);

  // Initialize on mount
  useEffect(() => {
    if (user?.id) {
      initializeStats();
    }
  }, [user?.id, initializeStats]);

  return {
    // Stats
    stats,
    loading,
    error,
    
    // Actions
    trackAction,
    recordGameResult,
    saveStats,
    refreshStats,
  };
}; 