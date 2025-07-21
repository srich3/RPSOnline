import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type User = Database['public']['Tables']['users']['Row'];

export interface UserStats {
  games_played: number;
  games_won: number;
  games_lost: number;
  total_attacks: number;
  successful_attacks: number;
  failed_attacks: number;
  total_defends: number;
  successful_defends: number;
  failed_defends: number;
  total_conquers: number;
  successful_conquers: number;
  failed_conquers: number;
  attacks_blocked: number;
  perfect_defenses: number;
  aggressive_wins: number;
  current_rating: number;
  highest_rating: number;
  win_streak: number;
  longest_win_streak: number;
  achievements: Achievement[];
  game_history: GameHistoryEntry[];
}

export interface Achievement {
  id: string;
  type: string;
  name: string;
  description: string;
  unlocked_at: string;
}

export interface GameHistoryEntry {
  id: string;
  game_id: string;
  won: boolean;
  opponent_id: string | null;
  game_actions: GameAction[];
  game_stats: {
    total_attacks: number;
    total_defends: number;
    total_conquers: number;
  };
  created_at: string;
}

export interface GameAction {
  playerId: string;
  actionType: 'attack' | 'defend' | 'conquer';
  targetSquare: number;
  pointsSpent: number;
  successful: boolean;
  timestamp: string;
}

export interface GameResult {
  gameId: string;
  won: boolean;
  opponentId: string | null;
  actions: GameAction[];
  gameStats: {
    total_attacks: number;
    total_defends: number;
    total_conquers: number;
  };
}

// Default stats template
export const DEFAULT_STATS: UserStats = {
  games_played: 0,
  games_won: 0,
  games_lost: 0,
  total_attacks: 0,
  successful_attacks: 0,
  failed_attacks: 0,
  total_defends: 0,
  successful_defends: 0,
  failed_defends: 0,
  total_conquers: 0,
  successful_conquers: 0,
  failed_conquers: 0,
  attacks_blocked: 0,
  perfect_defenses: 0,
  aggressive_wins: 0,
  current_rating: 1000,
  highest_rating: 1000,
  win_streak: 0,
  longest_win_streak: 0,
  achievements: [],
  game_history: []
};

class StatsManager {
  private localStats: UserStats | null = null;
  private userId: string | null = null;

  // Initialize stats manager with user data
  async initialize(userId: string): Promise<UserStats> {
    this.userId = userId;
    
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('stats_json')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error loading user stats:', error);
        this.localStats = { ...DEFAULT_STATS };
      } else {
        if (user.stats_json && typeof user.stats_json === 'object' && !Array.isArray(user.stats_json)) {
          this.localStats = user.stats_json as unknown as UserStats;
        } else {
          this.localStats = { ...DEFAULT_STATS };
        }
      }
    } catch (err) {
      console.error('Error initializing stats manager:', err);
      this.localStats = { ...DEFAULT_STATS };
    }

    return this.localStats;
  }

  // Get current local stats
  getStats(): UserStats | null {
    return this.localStats;
  }

  // Track an action during gameplay (local only)
  trackAction(actionType: 'attack' | 'defend' | 'conquer', successful: boolean): void {
    if (!this.localStats) return;

    switch (actionType) {
      case 'attack':
        this.localStats.total_attacks++;
        if (successful) {
          this.localStats.successful_attacks++;
        } else {
          this.localStats.failed_attacks++;
        }
        break;
      case 'defend':
        this.localStats.total_defends++;
        if (successful) {
          this.localStats.successful_defends++;
        } else {
          this.localStats.failed_defends++;
        }
        break;
      case 'conquer':
        this.localStats.total_conquers++;
        if (successful) {
          this.localStats.successful_conquers++;
        } else {
          this.localStats.failed_conquers++;
        }
        break;
    }

    // Check for achievements
    this.checkAchievements();
  }

  // Record game result (local only)
  recordGameResult(result: GameResult): void {
    if (!this.localStats) return;

    // Update game counts
    this.localStats.games_played++;
    if (result.won) {
      this.localStats.games_won++;
      this.localStats.win_streak++;
      this.localStats.longest_win_streak = Math.max(
        this.localStats.longest_win_streak,
        this.localStats.win_streak
      );
    } else {
      this.localStats.games_lost++;
      this.localStats.win_streak = 0;
    }

    // Add to game history
    const historyEntry: GameHistoryEntry = {
      id: crypto.randomUUID(),
      game_id: result.gameId,
      won: result.won,
      opponent_id: result.opponentId,
      game_actions: result.actions,
      game_stats: result.gameStats,
      created_at: new Date().toISOString()
    };

    this.localStats.game_history.unshift(historyEntry);
    
    // Keep only last 50 games in history
    if (this.localStats.game_history.length > 50) {
      this.localStats.game_history = this.localStats.game_history.slice(0, 50);
    }

    // Check for achievements
    this.checkAchievements();
  }

  // Check and award achievements
  private checkAchievements(): void {
    if (!this.localStats) return;

    const newAchievements: Achievement[] = [];

    // First Win
    if (this.localStats.games_won === 1 && !this.hasAchievement('first_win')) {
      newAchievements.push({
        id: crypto.randomUUID(),
        type: 'first_win',
        name: 'First Victory',
        description: 'Win your first game!',
        unlocked_at: new Date().toISOString()
      });
    }

    // Veteran Player (10 games)
    if (this.localStats.games_played === 10 && !this.hasAchievement('veteran')) {
      newAchievements.push({
        id: crypto.randomUUID(),
        type: 'veteran',
        name: 'Veteran Player',
        description: 'Play 10 games',
        unlocked_at: new Date().toISOString()
      });
    }

    // Dedicated Player (100 games)
    if (this.localStats.games_played === 100 && !this.hasAchievement('dedicated')) {
      newAchievements.push({
        id: crypto.randomUUID(),
        type: 'dedicated',
        name: 'Dedicated Player',
        description: 'Play 100 games',
        unlocked_at: new Date().toISOString()
      });
    }

    // Aggressive Player (50+ attacks)
    if (this.localStats.total_attacks >= 50 && !this.hasAchievement('aggressive')) {
      newAchievements.push({
        id: crypto.randomUUID(),
        type: 'aggressive',
        name: 'Aggressive Player',
        description: 'Use 50 attack actions',
        unlocked_at: new Date().toISOString()
      });
    }

    // Defensive Player (50+ defends)
    if (this.localStats.total_defends >= 50 && !this.hasAchievement('defensive')) {
      newAchievements.push({
        id: crypto.randomUUID(),
        type: 'defensive',
        name: 'Defensive Player',
        description: 'Use 50 defend actions',
        unlocked_at: new Date().toISOString()
      });
    }

    // Conqueror (50+ conquers)
    if (this.localStats.total_conquers >= 50 && !this.hasAchievement('conqueror')) {
      newAchievements.push({
        id: crypto.randomUUID(),
        type: 'conqueror',
        name: 'Conqueror',
        description: 'Use 50 conquer actions',
        unlocked_at: new Date().toISOString()
      });
    }

    // Add new achievements
    this.localStats.achievements.push(...newAchievements);
  }

  // Check if user has a specific achievement
  private hasAchievement(type: string): boolean {
    return this.localStats?.achievements.some(a => a.type === type) || false;
  }

  // Save stats to database (called at game end)
  async saveStats(): Promise<boolean> {
    if (!this.userId || !this.localStats) return false;

    try {
      const { error } = await supabase.rpc('update_user_stats', {
        user_uuid: this.userId,
        new_stats: JSON.parse(JSON.stringify(this.localStats))
      });

      if (error) {
        console.error('Error saving stats:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Error saving stats:', err);
      return false;
    }
  }

  // Reset local stats (for testing)
  reset(): void {
    this.localStats = { ...DEFAULT_STATS };
  }
}

// Export singleton instance
export const statsManager = new StatsManager(); 