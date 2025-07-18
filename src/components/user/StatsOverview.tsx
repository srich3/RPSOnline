'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Clock, Trophy, Target, Activity, Award, Zap } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';

interface StatsOverviewProps {
  className?: string;
}

export default function StatsOverview({ className = '' }: StatsOverviewProps) {
  const auth = useAuth();
  const [stats, setStats] = useState({
    totalGames: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    currentStreak: 0,
    bestStreak: 0,
    averageGameTime: '0m 0s',
    rating: 1000,
    ratingChange: 0
  });
  const [recentGames, setRecentGames] = useState<any[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (auth.user) {
      fetchUserStats();
      fetchRecentGames();
      fetchWeeklyStats();
      fetchAchievements();
    }
  }, [auth.user]);

  const fetchUserStats = async () => {
    if (!auth.user) return;
    
    try {
      const { data: profile } = await supabase
        .from('users')
        .select('wins, losses, rating')
        .eq('id', auth.user.id)
        .single();
      
      const { data: games } = await supabase
        .from('games')
        .select('id, winner_id, created_at')
        .or(`player1_id.eq.${auth.user.id},player2_id.eq.${auth.user.id}`)
        .eq('status', 'finished')
        .order('created_at', { ascending: false });
      let currentStreak = 0, bestStreak = 0;
      if (games && games.length > 0) {
        let streak = 0;
        for (const game of games) {
          if (game.winner_id === auth.user.id) {
            streak++;
            bestStreak = Math.max(bestStreak, streak);
          } else {
            streak = 0;
          }
        }
        currentStreak = (games[0].winner_id === auth.user.id) ? streak : 0;
      }
      if (profile) {
        const totalGames = profile.wins + profile.losses;
        const winRate = totalGames > 0 ? Math.round((profile.wins / totalGames) * 100) : 0;
        
        setStats({
          totalGames,
          wins: profile.wins,
          losses: profile.losses,
          winRate,
          currentStreak,
          bestStreak,
          averageGameTime: 'N/A', // Optional: implement if you want
          rating: profile.rating,
          ratingChange: 0 // Optional: implement if you want
        });
      }
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  };

  const fetchRecentGames = async () => {
    if (!auth.user) return;
    
    try {
      const { data: games } = await supabase
        .from('games')
        .select(`
          id,
          status,
          winner_id,
          created_at,
          player1:users!player1_id(username),
          player2:users!player2_id(username)
        `)
        .or(`player1_id.eq.${auth.user.id},player2_id.eq.${auth.user.id}`)
        .eq('status', 'finished')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (games) {
        const formattedGames = games.map(game => ({
          id: game.id,
          result: game.winner_id === auth.user?.id ? 'W' : 'L',
          opponent: game.player1?.username === auth.user?.email?.split('@')[0] 
            ? game.player2?.username || 'Unknown'
            : game.player1?.username || 'Unknown',
          time: formatTimeAgo(game.created_at),
          rating: '+15' // TODO: Calculate actual rating change
        }));
        setRecentGames(formattedGames);
      }
    } catch (error) {
      console.error('Error fetching recent games:', error);
    }
  };

  const fetchWeeklyStats = async () => {
    if (!auth.user) return;
    try {
      // Get all finished games for this user in the last 7 days
      const since = new Date();
      since.setDate(since.getDate() - 6);
      since.setHours(0, 0, 0, 0);
      const { data: games } = await supabase
        .from('games')
        .select('id, winner_id, created_at, player1_id, player2_id')
        .or(`player1_id.eq.${auth.user.id},player2_id.eq.${auth.user.id}`)
        .eq('status', 'finished')
        .gte('created_at', since.toISOString());
      // Aggregate by day
      const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      const week = Array(7).fill(0).map((_, i) => {
        const d = new Date(since);
        d.setDate(since.getDate() + i);
        return { day: days[d.getDay()], wins: 0, losses: 0 };
      });
      if (games) {
        games.forEach(game => {
          const d = new Date(game.created_at);
          const idx = Math.floor((d.getTime() - since.getTime()) / (1000*60*60*24));
          if (idx >= 0 && idx < 7 && auth.user) {
            if (game.winner_id === auth.user.id) week[idx].wins++;
            else week[idx].losses++;
          }
        });
      }
      setWeeklyStats(week);
    } catch (error) {
      console.error('Error fetching weekly stats:', error);
    }
  };

  const fetchAchievements = async () => {
    // TODO: Implement achievements system
    const mockAchievements = [
      { id: 1, name: 'First Victory', description: 'Won your first game!', icon: Trophy, unlocked: true },
      { id: 2, name: 'Win Streak', description: 'Won 5 games in a row', icon: Zap, unlocked: stats.currentStreak >= 5 },
      { id: 3, name: 'Veteran', description: 'Played 50 games', icon: Award, unlocked: stats.totalGames >= 50 }
    ];
    setAchievements(mockAchievements);
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };



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
            <div className="text-2xl font-bold text-white">{stats.totalGames}</div>
            <div className="text-gray-400 text-sm">Total Games</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">{stats.wins}</div>
            <div className="text-gray-400 text-sm">Wins</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400">{stats.losses}</div>
            <div className="text-gray-400 text-sm">Losses</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">{stats.winRate}%</div>
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
          {recentGames.length > 0 ? recentGames.map((game) => (
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
          )) : (
            <div className="text-center text-gray-400 py-8">
              No recent games found
            </div>
          )}
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
          Streaks
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-700/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-400">{stats.currentStreak}</div>
            <div className="text-gray-400 text-sm">Current Streak</div>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-yellow-400">{stats.bestStreak}</div>
            <div className="text-gray-400 text-sm">Best Streak</div>
          </div>
        </div>
      </motion.div>
    </div>
  );
} 