'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Edit, Trophy, Target, TrendingUp, User } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

interface ProfileCardProps {
  className?: string;
}

export default function ProfileCard({ className = '' }: ProfileCardProps) {
  const auth = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  
  // Use profile data from auth context, fallback to mock data
  const mockProfile = {
    username: auth.profile?.username || auth.user?.email?.split('@')[0] || 'Player',
    wins: auth.profile?.wins || 12,
    losses: auth.profile?.losses || 8,
    rating: auth.profile?.rating || 1250,
    total_games: (auth.profile?.wins || 0) + (auth.profile?.losses || 0) || 20
  };
  
  const [editedusername, setEditedusername] = useState(mockProfile.username);

  if (!auth.user) {
    return (
      <div className={`bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 shadow-lg ${className}`}>
        <div className="flex items-center justify-center h-32">
          <div className="text-gray-400">Please log in to view profile</div>
        </div>
      </div>
    );
  }

  const winRate = mockProfile.total_games > 0 
    ? Math.round((mockProfile.wins / mockProfile.total_games) * 100) 
    : 0;

  const getRatingTier = (rating: number) => {
    if (rating >= 2000) return { name: 'Master', color: 'text-purple-400', bg: 'bg-purple-500/20' };
    if (rating >= 1500) return { name: 'Expert', color: 'text-blue-400', bg: 'bg-blue-500/20' };
    if (rating >= 1000) return { name: 'Veteran', color: 'text-green-400', bg: 'bg-green-500/20' };
    if (rating >= 500) return { name: 'Rookie', color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
    return { name: 'Novice', color: 'text-gray-400', bg: 'bg-gray-500/20' };
  };

  const ratingTier = getRatingTier(mockProfile.rating);

  const handleSaveusername = async () => {
    // TODO: Implement username update logic
    setIsEditing(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 shadow-lg border border-gray-700 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <User className="w-6 h-6 text-white" />
          </div>
          <div>
            {isEditing ? (
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={editedusername}
                  onChange={(e) => setEditedusername(e.target.value)}
                  className="bg-gray-700 text-white px-3 py-1 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={20}
                />
                <button
                  onClick={handleSaveusername}
                  className="text-green-400 hover:text-green-300 text-sm"
                >
                  Save
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="text-gray-400 hover:text-gray-300 text-sm"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-white">{mockProfile.username}</h2>
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-gray-400 hover:text-gray-300 transition-colors"
                >
                  <Edit className="w-4 h-4" />
                </button>
              </div>
            )}
            <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${ratingTier.bg} ${ratingTier.color}`}>
              {ratingTier.name}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="bg-gray-700/50 rounded-lg p-4 text-center"
        >
          <div className="flex items-center justify-center mb-2">
            <Trophy className="w-5 h-5 text-yellow-400 mr-2" />
            <span className="text-2xl font-bold text-white">{mockProfile.wins}</span>
          </div>
          <p className="text-gray-300 text-sm">Wins</p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.05 }}
          className="bg-gray-700/50 rounded-lg p-4 text-center"
        >
          <div className="flex items-center justify-center mb-2">
            <Target className="w-5 h-5 text-red-400 mr-2" />
            <span className="text-2xl font-bold text-white">{mockProfile.losses}</span>
          </div>
          <p className="text-gray-300 text-sm">Losses</p>
        </motion.div>
      </div>

      {/* Win Rate and Rating */}
      <div className="space-y-4">
        <div className="bg-gray-700/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-300 text-sm">Win Rate</span>
            <span className="text-white font-semibold">{winRate}%</span>
          </div>
          <div className="w-full bg-gray-600 rounded-full h-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${winRate}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="bg-gradient-to-r from-green-400 to-green-500 h-2 rounded-full"
            />
          </div>
        </div>

        <div className="bg-gray-700/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <TrendingUp className="w-5 h-5 text-blue-400 mr-2" />
              <span className="text-gray-300 text-sm">Rating</span>
            </div>
            <span className="text-white font-bold text-lg">{mockProfile.rating}</span>
          </div>
        </div>
      </div>

      {/* Total Games */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="text-center">
          <span className="text-gray-400 text-sm">Total Games</span>
          <div className="text-white font-semibold text-lg">{mockProfile.total_games}</div>
        </div>
      </div>
    </motion.div>
  );
} 