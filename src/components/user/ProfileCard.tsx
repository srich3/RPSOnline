'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Edit, Trophy, Target, TrendingUp, User } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../ThemeProvider';
import { supabase } from '../../lib/supabase';

interface ProfileCardProps {
  className?: string;
}

export default function ProfileCard({ className = '' }: ProfileCardProps) {
  const auth = useAuth();
  const { theme } = useTheme();
  // Remove editing state and logic
  // const [isEditing, setIsEditing] = useState(false);
  
  // Use only real profile data
  const profile = auth.profile;

  if (!auth.user) {
    return (
      <div className={`bg-[var(--color-bg)] border border-[var(--color-dark-soft)] rounded-xl p-6 shadow-lg ${className}`}>
        <div className="flex items-center justify-center h-32">
          <div className="text-[var(--color-fg)]">Please log in to view profile</div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className={`bg-[var(--color-bg)] border border-[var(--color-dark-soft)] rounded-xl p-6 shadow-lg ${className}`}>
        <div className="flex items-center justify-center h-32">
          <div className="text-[var(--color-fg)]">Loading profile...</div>
        </div>
      </div>
    );
  }

  const totalGames = (profile.wins ?? 0) + (profile.losses ?? 0);
  const winRate = totalGames > 0 ? Math.round((profile.wins / totalGames) * 100) : 0;

  const getRatingTier = (rating: number) => {
    if (rating >= 2000) return { name: 'Master', color: 'text-[var(--color-purple)]', bg: 'bg-[var(--color-purple-light)]' };
    if (rating >= 1500) return { name: 'Expert', color: 'text-[var(--color-blue)]', bg: 'bg-[var(--color-blue-light)]' };
    if (rating >= 1000) return { name: 'Veteran', color: 'text-[var(--color-green)]', bg: 'bg-[var(--color-green-light)]' };
    if (rating >= 500) return { name: 'Rookie', color: 'text-[var(--color-yellow)]', bg: 'bg-[var(--color-yellow-light)]' };
    return { name: 'Novice', color: 'text-[var(--color-gray)]', bg: 'bg-[var(--color-gray-light)]' };
  };

  const ratingTier = getRatingTier(profile.rating ?? 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-[var(--color-bg)] border border-[var(--color-dark-soft)] rounded-xl p-6 shadow-lg ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-[var(--color-dark-soft)] rounded-full flex items-center justify-center">
            <User className="w-6 h-6 text-[var(--color-light)]" />
          </div>
          <div>
            {/* Username is now plain text, not editable */}
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold text-[var(--color-fg)]">{profile.username}</h2>
            </div>
            <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${ratingTier.bg} ${ratingTier.color}`}>
              {ratingTier.name}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6 ">
        <motion.div
          whileHover={{ scale: 1.05 }}
          className={`bg-[var(--color-bg-soft)] rounded-lg p-4 text-center`}
        >
          <div className="flex items-center justify-center mb-2 ">
            <Trophy className="w-5 h-5 text-[var(--color-yellow)] mr-2" />
            <span className="text-2xl font-bold text-[var(--color-fg)]">{profile.wins}</span>
          </div>
          <p className="text-[var(--color-fg)] text-sm">Wins</p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.05 }}
          className={`bg-[var(--color-bg-soft)] rounded-lg p-4 text-center`}
        >
          <div className="flex items-center justify-center mb-2">
            <Target className="w-5 h-5 text-[var(--color-red)] mr-2" />
            <span className="text-2xl font-bold text-[var(--color-fg)]">{profile.losses}</span>
          </div>
          <p className="text-[var(--color-fg)] text-sm">Achievements</p>
        </motion.div>
      </div>

      {/* Win Rate and Rating */}
      <div className="space-y-4">
        <div className={`bg-[var(--color-bg-soft)] rounded-lg p-4`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[var(--color-fg)] text-sm">Win Rate</span>
            <span className="text-[var(--color-fg)] font-semibold">{winRate}%</span>
          </div>
          <div className="w-full bg-[var(--color-gray-soft)] rounded-full h-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${winRate}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className={`bg-[var(--color-green)] h-2 rounded-full`}
            />
          </div>
        </div>

        <div className={`bg-[var(--color-bg-soft)] rounded-lg p-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <TrendingUp className="w-5 h-5 text-[var(--color-blue)] mr-2" />
              <span className="text-[var(--color-fg)] text-sm">Rating</span>
            </div>
            <span className="text-[var(--color-fg)] font-bold text-lg">{profile.rating}</span>
          </div>
        </div>
      </div>

      {/* Total Games */}
      <div className="mt-4 pt-4 border-t border-[var(--color-dark-soft)]">
        <div className="text-center">
          <span className="text-[var(--color-fg)] text-sm">Total Games</span>
          <div className="text-[var(--color-fg)] font-semibold text-lg">{totalGames}</div>
        </div>
      </div>
    </motion.div>
  );
} 