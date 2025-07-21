'use client';

import React from 'react';
import { useUserStats } from '../../hooks/useUserStats';
import { useTheme } from '../ThemeProvider';
import { Trophy, Target, Shield, Zap, TrendingUp, Award } from 'lucide-react';

export const StatsOverview: React.FC = () => {
  const { theme } = useTheme();
  const {
    stats,
    loading,
    error,
  } = useUserStats();

  if (loading) {
    return (
      <div className={`${theme === 'light' ? 'bg-white border-gray-200' : 'bg-black border-gray-800'} rounded-lg shadow-md p-6 border`}>
        <div className="animate-pulse">
          <div className={`h-4 ${theme === 'light' ? 'bg-gray-200' : 'bg-gray-700'} rounded w-1/4 mb-4`}></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className={`h-16 ${theme === 'light' ? 'bg-gray-200' : 'bg-gray-700'} rounded`}></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${theme === 'light' ? 'bg-white border-gray-200' : 'bg-black border-gray-800'} rounded-lg shadow-md p-6 border`}>
        <div className="text-red-600 text-center">
          <p>Failed to load stats: {error}</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className={`${theme === 'light' ? 'bg-white border-gray-200' : 'bg-black border-gray-800'} rounded-lg shadow-md p-6 border`}>
        <div className={`${theme === 'light' ? 'text-gray-500' : 'text-gray-400'} text-center`}>
          <p>No stats available</p>
        </div>
      </div>
    );
  }

  const winRate = stats.games_played > 0 
    ? ((stats.games_won / stats.games_played) * 100).toFixed(1)
    : '0.0';

  const attackSuccessRate = stats.total_attacks > 0
    ? ((stats.successful_attacks / stats.total_attacks) * 100).toFixed(1)
    : '0.0';

  const defendSuccessRate = stats.total_defends > 0
    ? ((stats.successful_defends / stats.total_defends) * 100).toFixed(1)
    : '0.0';

  const conquerSuccessRate = stats.total_conquers > 0
    ? ((stats.successful_conquers / stats.total_conquers) * 100).toFixed(1)
    : '0.0';

  // Instead of stats.map, render each stat property individually
  return (
    <div className="p-6 rounded-lg shadow-lg bg-[var(--color-bg)] border border-[var(--color-dark-soft)]">
      <h2 className="text-2xl font-bold mb-4 text-[var(--color-fg)]">Game Statistics</h2>
      <div className="mb-4 text-[color-mix(in_srgb,var(--color-fg)_60%,var(--color-bg)_40%)] font-light">Your recent game performance</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Games Played */}
        <div className="rounded-lg p-4 text-center bg-[var(--color-bg-soft)]">
          <div className="text-2xl font-bold text-[var(--color-fg)]">{stats.games_played}</div>
          <div className="text-sm text-[color-mix(in_srgb,var(--color-fg)_70%,var(--color-bg)_30%)]">Games Played</div>
        </div>
        {/* Win Rate */}
        <div className="rounded-lg p-4 text-center bg-[var(--color-bg-soft)]">
          <div className="text-2xl font-bold text-[var(--color-fg)]">{stats.games_played > 0 ? Math.round((stats.games_won / stats.games_played) * 100) : 0}%</div>
          <div className="text-sm text-[color-mix(in_srgb,var(--color-fg)_70%,var(--color-bg)_30%)]">Win Rate</div>
          <div className="text-xs text-[color-mix(in_srgb,var(--color-fg)_60%,var(--color-bg)_40%)]">{stats.games_won}W / {stats.games_lost}L</div>
        </div>
        {/* Current Rating */}
        <div className="rounded-lg p-4 text-center bg-[var(--color-bg-soft)]">
          <div className="text-2xl font-bold text-[var(--color-fg)]">{stats.current_rating}</div>
          <div className="text-sm text-[color-mix(in_srgb,var(--color-fg)_70%,var(--color-bg)_30%)]">Rating</div>
          <div className="text-xs text-[color-mix(in_srgb,var(--color-fg)_60%,var(--color-bg)_40%)]">Best: {stats.highest_rating}</div>
        </div>
        {/* Win Streak */}
        <div className="rounded-lg p-4 text-center bg-[var(--color-bg-soft)]">
          <div className="text-2xl font-bold text-[var(--color-fg)]">{stats.win_streak}</div>
          <div className="text-sm text-[color-mix(in_srgb,var(--color-fg)_70%,var(--color-bg)_30%)]">Win Streak</div>
          <div className="text-xs text-[color-mix(in_srgb,var(--color-fg)_60%,var(--color-bg)_40%)]">Best: {stats.longest_win_streak}</div>
        </div>
      </div>
    </div>
  );
}; 