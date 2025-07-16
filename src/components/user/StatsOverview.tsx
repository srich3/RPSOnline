'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Clock, Trophy, Target, Activity } from 'lucide-react';

interface StatsOverviewProps {
  className?: string;
}

export default function StatsOverview({ className = '' }: StatsOverviewProps) {
  // TODO: Replace with actual data from database
  const mockStats = {
    totalGames: 20,
    wins: 12,
    losses: 8,
    winRate: 60,
    currentStreak: 3,
    bestStreak: 5,
    averageGameTime: '4m 32s',
    rating: 1250,
    ratingChange: +25
  };

  const recentGames = [
    { id: 1, result: 'W', opponent: 'Player123', time: '2m ago', rating: '+15' },
    { id: 2, result: 'L', opponent: 'RPSMaster', time: '15m ago', rating: '-8' },
    { id: 3, result: 'W', opponent: 'GamePro', time: '1h ago', rating: '+12' },
    { id: 4, result: 'W', opponent: 'Newbie', time: '2h ago', rating: '+6' },
    { id: 5, result: 'L', opponent: 'Veteran', time: '3h ago', rating: '-10' }
  ];

  const weeklyStats = [
    { day: 'Mon', wins: 3, losses: 1 },
    { day: 'Tue', wins: 2, losses: 2 },
    { day: 'Wed', wins: 4, losses: 0 },
    { day: 'Thu', wins: 1, losses: 3 },
    { day: 'Fri', wins: 2, losses: 1 },
    { day: 'Sat', wins: 0, losses: 2 },
    { day: 'Sun', wins: 0, losses: 0 }
  ];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Performance Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 shadow-lg border border-gray-700"
      >
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
          <Activity className="w-5 h-5 mr-2 text-blue-400" />
          Performance Overview
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{mockStats.totalGames}</div>
            <div className="text-gray-400 text-sm">Total Games</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">{mockStats.wins}</div>
            <div className="text-gray-400 text-sm">Wins</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400">{mockStats.losses}</div>
            <div className="text-gray-400 text-sm">Losses</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">{mockStats.winRate}%</div>
            <div className="text-gray-400 text-sm">Win Rate</div>
          </div>
        </div>
      </motion.div>

      {/* Weekly Performance Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 shadow-lg border border-gray-700"
      >
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
          <BarChart3 className="w-5 h-5 mr-2 text-green-400" />
          Weekly Performance
        </h3>
        
        <div className="flex items-end justify-between h-32 space-x-2">
          {weeklyStats.map((stat, index) => (
            <div key={stat.day} className="flex flex-col items-center flex-1">
              <div className="flex flex-col items-center space-y-1 w-full">
                <div className="flex flex-col items-center space-y-1">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${(stat.wins / 4) * 100}%` }}
                    transition={{ delay: index * 0.1 }}
                    className="w-full bg-green-500 rounded-t"
                    style={{ minHeight: '4px' }}
                  />
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${(stat.losses / 4) * 100}%` }}
                    transition={{ delay: index * 0.1 + 0.1 }}
                    className="w-full bg-red-500 rounded-t"
                    style={{ minHeight: '4px' }}
                  />
                </div>
              </div>
              <div className="text-gray-400 text-xs mt-2">{stat.day}</div>
            </div>
          ))}
        </div>
        
        <div className="flex justify-center space-x-4 mt-4 text-xs">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded mr-1"></div>
            <span className="text-gray-400">Wins</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-red-500 rounded mr-1"></div>
            <span className="text-gray-400">Losses</span>
          </div>
        </div>
      </motion.div>

      {/* Recent Games */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 shadow-lg border border-gray-700"
      >
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
          <Clock className="w-5 h-5 mr-2 text-yellow-400" />
          Recent Games
        </h3>
        
        <div className="space-y-3">
          {recentGames.map((game) => (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  game.result === 'W' 
                    ? 'bg-green-500 text-white' 
                    : 'bg-red-500 text-white'
                }`}>
                  {game.result}
                </div>
                <div>
                  <div className="text-white font-medium">{game.opponent}</div>
                  <div className="text-gray-400 text-sm">{game.time}</div>
                </div>
              </div>
              <div className={`text-sm font-semibold ${
                game.rating.startsWith('+') ? 'text-green-400' : 'text-red-400'
              }`}>
                {game.rating}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Streaks and Achievements */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 shadow-lg border border-gray-700"
      >
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
          <Trophy className="w-5 h-5 mr-2 text-yellow-400" />
          Streaks & Achievements
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-700/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-400">{mockStats.currentStreak}</div>
            <div className="text-gray-400 text-sm">Current Streak</div>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-yellow-400">{mockStats.bestStreak}</div>
            <div className="text-gray-400 text-sm">Best Streak</div>
          </div>
        </div>
        
        <div className="mt-4 p-4 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-lg border border-yellow-500/30">
          <div className="flex items-center">
            <Trophy className="w-5 h-5 text-yellow-400 mr-2" />
            <div>
              <div className="text-white font-medium">First Victory</div>
              <div className="text-gray-400 text-sm">Won your first game!</div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
} 