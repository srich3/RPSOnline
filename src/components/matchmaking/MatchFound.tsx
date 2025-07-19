import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, User, Clock, Check, X, AlertCircle } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { Game } from '../../types/database';
import { supabase } from '../../lib/supabase';

interface MatchFoundProps {
  match: Game;
  onAccept: (gameId: string) => Promise<void>;
  onDecline: (gameId: string) => Promise<void>;
  onClose: () => void;
  loading?: boolean;
}

export default function MatchFound({ 
  match, 
  onAccept, 
  onDecline, 
  onClose, 
  loading = false 
}: MatchFoundProps) {
  const { user, profile } = useAuth();
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [opponentProfile, setOpponentProfile] = useState<any>(null);
  const [loadingOpponent, setLoadingOpponent] = useState(false);

  const isPlayer1 = user?.id === match.player1_id;
  const opponentId = isPlayer1 ? match.player2_id : match.player1_id;

  // Fetch opponent's profile
  const fetchOpponentProfile = async () => {
    if (!opponentId) return;
    
    setLoadingOpponent(true);
    try {
      const { data: profile, error } = await supabase
        .from('users')
        .select('username, rating')
        .eq('id', opponentId)
        .single();

      if (error) {
        console.error('Error fetching opponent profile:', error);
      } else {
        setOpponentProfile(profile);
      }
    } catch (error) {
      console.error('Error fetching opponent profile:', error);
    } finally {
      setLoadingOpponent(false);
    }
  };

  // Fetch opponent profile when component mounts
  useEffect(() => {
    fetchOpponentProfile();
  }, [opponentId]);

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      await onAccept(match.id);
    } catch (error) {
      console.error('Error accepting match:', error);
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDecline = async () => {
    setIsDeclining(true);
    try {
      await onDecline(match.id);
    } catch (error) {
      console.error('Error declining match:', error);
    } finally {
      setIsDeclining(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 shadow-xl border border-gray-700 max-w-md w-full"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-center space-y-4">
            {/* Match Found Animation */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto"
            >
              <Trophy className="w-10 h-10 text-green-400" />
            </motion.div>

            <div>
              <h3 className="text-xl font-bold text-white mb-2">
                {match.player1_accepted && match.player2_accepted ? 'Game Starting!' : 'Match Found!'}
              </h3>
              <p className="text-gray-400 text-sm">
                {match.player1_accepted && match.player2_accepted 
                  ? 'Both players accepted! Starting the game...'
                  : 'A suitable opponent has been found. Ready to play?'}
              </p>
            </div>

            {/* Opponent Preview */}
            <div className="bg-gray-700/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-center space-x-2">
                <User className="w-4 h-4 text-gray-400" />
                <span className="text-gray-400 text-sm">Opponent</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Username:</span>
                <span className="text-white font-medium">
                  {loadingOpponent ? (
                    <span className="text-gray-400">Loading...</span>
                  ) : opponentProfile?.username ? (
                    opponentProfile.username
                  ) : (
                    <span className="text-gray-400">Unknown</span>
                  )}
                </span>
              </div>
              
              {/* Opponent Status */}
              <div className="flex justify-center">
                {loadingOpponent ? (
                  <span className="text-gray-400 text-sm">Loading status...</span>
                ) : (
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                    isPlayer1 ? (
                      match.player2_accepted ? (
                        'bg-green-900/50 text-green-400 border border-green-700'
                      ) : (
                        'bg-yellow-900/50 text-yellow-400 border border-yellow-700'
                      )
                    ) : (
                      match.player1_accepted ? (
                        'bg-green-900/50 text-green-400 border border-green-700'
                      ) : (
                        'bg-yellow-900/50 text-yellow-400 border border-yellow-700'
                      )
                    )
                  }`}>
                    {isPlayer1 ? (
                      match.player2_accepted ? (
                        <>
                          <Check className="w-3 h-3 mr-1" />
                          Opponent Accepted
                        </>
                      ) : (
                        <>
                          <Clock className="w-3 h-3 mr-1" />
                          Waiting for Opponent
                        </>
                      )
                    ) : (
                      match.player1_accepted ? (
                        <>
                          <Check className="w-3 h-3 mr-1" />
                          Opponent Accepted
                        </>
                      ) : (
                        <>
                          <Clock className="w-3 h-3 mr-1" />
                          Waiting for Opponent
                        </>
                      )
                    )}
                  </div>
                )}
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Rating:</span>
                <span className="text-white font-medium">
                  {loadingOpponent ? (
                    <span className="text-gray-400">Loading...</span>
                  ) : opponentProfile?.rating ? (
                    `${opponentProfile.rating} ± 200`
                  ) : (
                    <span className="text-gray-400">Unknown</span>
                  )}
                </span>
              </div>

              {/* Match Status */}
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Match Status:</span>
                <span className="text-white font-medium">
                  {match.player1_accepted && match.player2_accepted ? (
                    <span className="text-green-400">Both Accepted</span>
                  ) : (
                    <span className="text-blue-400">Pending Acceptance</span>
                  )}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleAccept}
                disabled={loading || isAccepting || isDeclining || (isPlayer1 ? match.player1_accepted : match.player2_accepted)}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAccepting ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Clock className="w-4 h-4" />
                  </motion.div>
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>
                  {isAccepting ? 'Accepting...' : 
                   (isPlayer1 ? match.player1_accepted : match.player2_accepted) ? 'Accepted' : 'Accept'}
                </span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleDecline}
                disabled={loading || isAccepting || isDeclining}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeclining ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Clock className="w-4 h-4" />
                  </motion.div>
                ) : (
                  <X className="w-4 h-4" />
                )}
                <span>{isDeclining ? 'Declining...' : 'Decline'}</span>
              </motion.button>
            </div>

            {/* Auto-accept timer info */}
            <div className="text-xs text-gray-500">
              <Clock className="w-3 h-3 inline mr-1" />
              Auto-accept in 30 seconds
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
} 