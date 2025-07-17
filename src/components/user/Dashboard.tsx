'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Play, Users, Trophy, Settings, Bell, Search } from 'lucide-react';
import ProfileCard from './ProfileCard';
import StatsOverview from './StatsOverview';

interface DashboardProps {
  className?: string;
}

export default function Dashboard({ className = '' }: DashboardProps) {
  // TODO: Replace with actual data from database
  const mockTournaments = [
    {
      id: 1,
      name: 'Weekly Championship',
      participants: 128,
      prize: '1000 Coins',
      status: 'active',
      timeLeft: '2d 14h'
    },
    {
      id: 2,
      name: 'Beginner\'s Cup',
      participants: 64,
      prize: '500 Coins',
      status: 'upcoming',
      timeLeft: '5d 8h'
    },
    {
      id: 3,
      name: 'Pro League',
      participants: 32,
      prize: '2000 Coins',
      status: 'upcoming',
      timeLeft: '1w 2d'
    }
  ];

  const mockFriends = [
    { id: 1, name: 'Player123', status: 'online', lastSeen: '2m ago' },
    { id: 2, name: 'RPSMaster', status: 'in-game', lastSeen: '5m ago' },
    { id: 3, name: 'GamePro', status: 'offline', lastSeen: '1h ago' }
  ];

  return (
    <div className={`min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 ${className}`}>
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 sticky top-0 z-50"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold text-white">RPSOnline Dashboard</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <button className="p-2 text-gray-400 hover:text-white transition-colors">
                <Bell className="w-5 h-5" />
              </button>
              <button className="p-2 text-gray-400 hover:text-white transition-colors">
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Profile & Quick Actions */}
          <div className="lg:col-span-1 space-y-6">
            {/* Profile Card */}
            <ProfileCard />
            
            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 shadow-lg border border-gray-700"
            >
              <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
              
              <div className="space-y-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-all duration-200 shadow-lg"
                >
                  <Play className="w-5 h-5" />
                  <span>Quick Play</span>
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-all duration-200"
                >
                  <Trophy className="w-5 h-5" />
                  <span>Join Tournament</span>
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-all duration-200"
                >
                  <Users className="w-5 h-5" />
                  <span>Find Friends</span>
                </motion.button>
              </div>
            </motion.div>

            {/* Friends List */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 shadow-lg border border-gray-700"
            >
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Users className="w-5 h-5 mr-2 text-green-400" />
                Friends Online
              </h3>
              
              <div className="space-y-3">
                {mockFriends.map((friend) => (
                  <div key={friend.id} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${
                        friend.status === 'online' ? 'bg-green-400' :
                        friend.status === 'in-game' ? 'bg-yellow-400' : 'bg-gray-400'
                      }`} />
                      <div>
                        <div className="text-white font-medium">{friend.name}</div>
                        <div className="text-gray-400 text-sm">{friend.lastSeen}</div>
                      </div>
                    </div>
                    <div className="text-gray-400 text-xs capitalize">{friend.status}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Right Column - Stats & Tournaments */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stats Overview */}
            <StatsOverview />
            
            {/* Tournaments */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 shadow-lg border border-gray-700"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white flex items-center">
                  <Trophy className="w-5 h-5 mr-2 text-yellow-400" />
                  Active Tournaments
                </h3>
                <button className="text-blue-400 hover:text-blue-300 text-sm font-medium">
                  View All
                </button>
              </div>
              
              <div className="space-y-4">
                {mockTournaments.map((tournament) => (
                  <motion.div
                    key={tournament.id}
                    whileHover={{ scale: 1.02 }}
                    className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg border border-gray-600"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h4 className="text-white font-semibold">{tournament.name}</h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          tournament.status === 'active' 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {tournament.status}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4 mt-2 text-sm text-gray-400">
                        <span>{tournament.participants} participants</span>
                        <span>Prize: {tournament.prize}</span>
                        <span>Ends in {tournament.timeLeft}</span>
                      </div>
                    </div>
                    
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        tournament.status === 'active'
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-gray-600 hover:bg-gray-500 text-white'
                      }`}
                    >
                      {tournament.status === 'active' ? 'Join' : 'Register'}
                    </motion.button>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Search Players */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 shadow-lg border border-gray-700"
            >
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Search className="w-5 h-5 mr-2 text-blue-400" />
                Find Players
              </h3>
              
              <div className="flex space-x-3">
                <input
                  type="text"
                  placeholder="Search by username..."
                  className="flex-1 bg-gray-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-600"
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  Search
                </motion.button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
} 