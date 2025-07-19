import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, X, Clock, Users, Trophy, AlertCircle } from 'lucide-react';
import { useMatchmaking } from '../../hooks/useMatchmaking';
import { useAuth } from '../../components/auth/AuthProvider';
import MatchFound from './MatchFound';

interface QueueManagerProps {
  className?: string;
}

export default function QueueManager({ className = '' }: QueueManagerProps) {
  const { user, profile } = useAuth();
  const {
    isInQueue,
    queuePosition,
    estimatedWaitTime,
    matchFound,
    error,
    loading,
    joinQueue,
    leaveQueue,
    acceptMatch,
    declineMatch,
  } = useMatchmaking({
    autoAcceptMatch: false, // Let user manually accept
    maxWaitTime: 120, // 2 minutes
    ratingRange: 300, // ±300 rating points
  });

  const [showMatchModal, setShowMatchModal] = useState(false);

  const formatWaitTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const handleJoinQueue = async () => {
    if (!user) {
      // Handle not logged in
      return;
    }
    await joinQueue();
  };

  const handleAcceptMatch = async () => {
    if (matchFound) {
      await acceptMatch(matchFound.id);
      setShowMatchModal(false);
    }
  };

  const handleDeclineMatch = async () => {
    if (matchFound) {
      await declineMatch(matchFound.id);
      setShowMatchModal(false);
    }
  };

  // Show match found modal
  React.useEffect(() => {
    if (matchFound) {
      setShowMatchModal(true);
    }
  }, [matchFound]);

  if (!user) {
    return (
      <div className={`bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 shadow-lg border border-gray-700 ${className}`}>
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Login Required</h3>
          <p className="text-gray-400">Please log in to join matchmaking</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 shadow-lg border border-gray-700 ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white flex items-center">
            <Trophy className="w-5 h-5 mr-2 text-yellow-400" />
            Quick Play
          </h3>
          
          {profile && (
            <div className="text-sm text-gray-400">
              Rating: {profile.rating}
            </div>
          )}
        </div>

        {/* Queue Status */}
        <AnimatePresence mode="wait">
          {!isInQueue && !matchFound ? (
            <motion.div
              key="join-queue"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <div className="text-center">
                <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h4 className="text-white font-medium mb-2">Find an Opponent</h4>
                <p className="text-gray-400 text-sm mb-6">
                  Join the queue to find players with similar skill level
                </p>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleJoinQueue}
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Clock className="w-5 h-5" />
                  </motion.div>
                ) : (
                  <Play className="w-5 h-5" />
                )}
                <span>{loading ? 'Joining...' : 'Find Match'}</span>
              </motion.button>
            </motion.div>
          ) : isInQueue ? (
            <motion.div
              key="in-queue"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <div className="text-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="w-16 h-16 text-blue-400 mx-auto mb-4"
                >
                  <Clock className="w-full h-full" />
                </motion.div>
                <h4 className="text-white font-medium mb-2">Searching for Opponent</h4>
                <p className="text-gray-400 text-sm mb-4">
                  Looking for players with similar skill level...
                </p>
              </div>

              {/* Queue Info */}
              <div className="bg-gray-700/50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Position in queue:</span>
                  <span className="text-white font-medium">
                    {queuePosition || 'Calculating...'}
                  </span>
                </div>
                
                {estimatedWaitTime !== null && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Wait time:</span>
                    <span className="text-white font-medium">
                      {formatWaitTime(estimatedWaitTime)}
                    </span>
                  </div>
                )}
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={leaveQueue}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-all duration-200"
              >
                <X className="w-5 h-5" />
                <span>Cancel Search</span>
              </motion.button>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Error Display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-4 p-3 bg-red-900/50 border border-red-700 rounded-lg"
            >
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span className="text-red-400 text-sm">{error}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Match Found Modal */}
      <AnimatePresence>
        {showMatchModal && matchFound && (
          <MatchFound
            match={matchFound}
            onAccept={handleAcceptMatch}
            onDecline={handleDeclineMatch}
            onClose={() => setShowMatchModal(false)}
            loading={loading}
          />
        )}
      </AnimatePresence>
    </>
  );
} 