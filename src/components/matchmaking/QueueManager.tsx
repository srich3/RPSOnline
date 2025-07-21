import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, X, Clock, Users, Trophy, AlertCircle, Check, User } from 'lucide-react';
import { useMatchmaking } from '../../hooks/useMatchmaking';
import { useAuth } from '../../components/auth/AuthProvider';
import { supabase } from '../../lib/supabase';

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
    matchFoundData, // <-- add this
    error,
    loading,
    isUnderDeclinePenalty,
    remainingPenaltyTime,
    joinQueue,
    leaveQueue,
    acceptMatch,
    declineMatch,
    setError,
  } = useMatchmaking({
    autoAcceptMatch: false, // Let user manually accept
    maxWaitTime: 120, // 2 minutes
    ratingRange: 300, // ±300 rating points
  });

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
    }
  };

  const handleDeclineMatch = async () => {
    if (matchFound && !loading) {
      try {
        await declineMatch(matchFound.id);
      } catch (error) {
        console.error('Error declining match:', error);
        // Silently handle the error - the match was likely already declined
        // The useMatchmaking hook will handle the state updates
      }
    }
  };

  // Get opponent info
  const getOpponentInfo = () => {
    if (!matchFound || !user) return null;
    // Prefer matchFoundData for usernames if available
    let opponentUsername;
    const isPlayer1 = matchFound.player1_id === user.id;
    if (isPlayer1) {
      opponentUsername = matchFoundData?.player2_username;
    } else {
      opponentUsername = matchFoundData?.player1_username;
    }
    return {
      username: opponentUsername || 'Unknown Player',
      isPlayer1
    };
  };

  const opponent = getOpponentInfo();

  // Get acceptance status
  const getAcceptanceStatus = () => {
    if (!matchFound || !user) return null;
    
    const isPlayer1 = matchFound.player1_id === user.id;
    const hasAccepted = isPlayer1 ? matchFound.player1_accepted : matchFound.player2_accepted;
    const opponentAccepted = isPlayer1 ? matchFound.player2_accepted : matchFound.player1_accepted;
    
    return {
      hasAccepted,
      opponentAccepted,
      bothAccepted: hasAccepted && opponentAccepted
    };
  };

  const acceptanceStatus = getAcceptanceStatus();

  // Countdown timer for match acceptance
  const [timeLeft, setTimeLeft] = useState(30); // 30 seconds to accept
  const [isCountingDown, setIsCountingDown] = useState(false);

  // Start countdown when match is found
  useEffect(() => {
    if (matchFound && !isCountingDown) {
      setIsCountingDown(true);
      setTimeLeft(30);
    } else if (!matchFound) {
      setIsCountingDown(false);
      setTimeLeft(30);
    }
  }, [matchFound, isCountingDown]);

  // Countdown effect
  useEffect(() => {
    if (!isCountingDown || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Auto decline when time runs out
          if (matchFound) {
            handleDeclineMatch();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isCountingDown, timeLeft, matchFound]);

  const formatTimeLeft = (seconds: number) => {
    return `${seconds}s`;
  };

  // Add a helper to detect opponent decline error
  const opponentDeclined = error && error.toLowerCase().includes('opponent declined');

  // Automatically clear the error after a short delay if opponent declined
  useEffect(() => {
    if (opponentDeclined) {
      const timer = setTimeout(() => {
        setError(''); // Clear the error to return to Find Match state
      }, 2000); // 2 seconds
      return () => clearTimeout(timer);
    }
  }, [opponentDeclined, setError]);

  if (!user) {
    return (
      <div className={`rounded-xl p-6 shadow-lg border bg-[var(--color-bg)] border-[var(--color-dark-soft)] ${className}`}>
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-[color-mix(in_srgb,var(--color-fg)_40%,var(--color-bg)_60%)] mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[var(--color-fg)] mb-2">Login Required</h3>
          <p className="text-[color-mix(in_srgb,var(--color-fg)_60%,var(--color-bg)_40%)]">Please log in to join matchmaking</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`queue-manager ${className}`}>
      <div className={`rounded-xl p-6 shadow-lg border bg-[var(--color-bg)] border-[var(--color-dark-soft)] ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-[var(--color-fg)] flex items-center">
            <Trophy className="w-5 h-5 mr-2 text-yellow-400" />
            Quick Play
          </h3>
          <div className="flex items-center space-x-2">
            {profile && (
              <div className="text-sm text-[color-mix(in_srgb,var(--color-fg)_60%,var(--color-bg)_40%)]">
                Rating: {profile.rating}
              </div>
            )}
          </div>
        </div>
        {/* Queue Status */}
        <AnimatePresence mode="wait">
          {loading && !isInQueue && !matchFound ? (
            <motion.div
              key="restoring-queue"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <div className="text-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="w-16 h-16 text-[var(--color-accent)] mx-auto mb-4"
                >
                  <Clock className="w-full h-full" />
                </motion.div>
                <h4 className="text-[var(--color-fg)] font-medium mb-2">Restoring Queue</h4>
                <p className="text-[color-mix(in_srgb,var(--color-fg)_60%,var(--color-bg)_40%)] text-sm mb-6">
                  Checking if you were in a queue before...
                </p>
              </div>
            </motion.div>
          ) : matchFound ? (
            <motion.div
              key="match-found"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <div className="text-center">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="w-16 h-16 text-green-400 mx-auto mb-4"
                >
                  <Trophy className="w-full h-full" />
                </motion.div>
                <h4 className="text-[var(--color-fg)] font-medium mb-2">Match Found!</h4>
                <p className="text-[color-mix(in_srgb,var(--color-fg)_60%,var(--color-bg)_40%)] text-sm mb-4">
                  A player is ready to challenge you!
                </p>
                {/* Opponent Username Display */}
                {opponent && (
                  <div className="flex items-center justify-center space-x-2 mb-2">
                    <User className="w-5 h-5 text-[var(--color-fg)]" />
                    <span className="text-[var(--color-fg)] font-semibold">{opponent.username}</span>
                  </div>
                )}
              </div>
              {/* Acceptance Status */}
              {acceptanceStatus && (
                <div className="bg-[color-mix(in_srgb,var(--color-dark-soft)_80%,var(--color-bg)_20%)] rounded-lg p-4">
                  <div className="text-center space-y-3">
                    {acceptanceStatus.bothAccepted ? (
                      <>
                        <div className="flex items-center justify-center space-x-2">
                          <Check className="w-5 h-5 text-green-400" />
                          <span className="text-green-400 font-medium">Both Players Accepted!</span>
                        </div>
                        <p className="text-[color-mix(in_srgb,var(--color-fg)_60%,var(--color-bg)_40%)] text-sm">
                          Starting game...
                        </p>
                      </>
                    ) : acceptanceStatus.hasAccepted ? (
                      <>
                        <div className="flex items-center justify-center space-x-2">
                          <Clock className="w-5 h-5 text-orange-400" />
                          <span className="text-orange-400 font-medium">Waiting on Opponent</span>
                        </div>
                        <p className="text-[color-mix(in_srgb,var(--color-fg)_60%,var(--color-bg)_40%)] text-sm">
                          You've accepted. Waiting for the other player...
                        </p>
                        {/* Show opponent username */}
                        {opponent && (
                          <div className="text-xs text-[color-mix(in_srgb,var(--color-fg)_60%,var(--color-bg)_40%)] mt-1">
                            Waiting for <span className="font-semibold">{opponent.username}</span> to accept...
                          </div>
                        )}
                      </>
                    ) : acceptanceStatus.opponentAccepted ? (
                      <>
                        <div className="flex items-center justify-center space-x-2">
                          <Check className="w-5 h-5 text-green-400" />
                          <span className="text-green-400 font-medium">Opponent Has Accepted</span>
                        </div>
                        <p className="text-[color-mix(in_srgb,var(--color-fg)_60%,var(--color-bg)_40%)] text-sm">
                          The other player is ready. Please accept to start!
                        </p>
                        {/* Show opponent username */}
                        {opponent && (
                          <div className="text-xs text-[color-mix(in_srgb,var(--color-fg)_60%,var(--color-bg)_40%)] mt-1">
                            <span className="font-semibold">{opponent.username}</span> is ready!
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-center space-x-2">
                          <Clock className="w-5 h-5 text-orange-400" />
                          <span className="text-orange-400 font-medium">Waiting for Acceptance</span>
                        </div>
                        <p className="text-[color-mix(in_srgb,var(--color-fg)_60%,var(--color-bg)_40%)] text-sm">
                          Both players need to accept to start the game
                        </p>
                        {/* Show opponent username */}
                        {opponent && (
                          <div className="text-xs text-[color-mix(in_srgb,var(--color-fg)_60%,var(--color-bg)_40%)] mt-1">
                            Waiting for <span className="font-semibold">{opponent.username}</span> to accept...
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
              {/* Countdown Timer - Only show if current player hasn't accepted yet */}
              {acceptanceStatus && !acceptanceStatus.hasAccepted && (
                <div className="bg-[color-mix(in_srgb,var(--color-dark-soft)_80%,var(--color-bg)_20%)] rounded-lg p-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-2 mb-2">
                      <Clock className="w-5 h-5 text-orange-400" />
                      <span className="text-[var(--color-fg)] font-medium">Time to Accept</span>
                    </div>
                    <div className={`text-2xl font-bold ${timeLeft <= 10 ? 'text-red-400' : 'text-green-400'}`}>{formatTimeLeft(timeLeft)}</div>
                    <p className="text-[color-mix(in_srgb,var(--color-fg)_60%,var(--color-bg)_40%)] text-sm mt-2">
                      Accept quickly or the match will be declined automatically
                    </p>
                  </div>
                </div>
              )}
              {/* Accept/Decline Buttons - Only show if player hasn't accepted yet */}
              {acceptanceStatus && !acceptanceStatus.hasAccepted && (
                <div className="flex space-x-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleAcceptMatch}
                    disabled={loading}
                    className="flex-1 font-semibold py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: 'var(--color-dark)',
                      color: 'var(--color-light)',
                    }}
                  >
                    <Check className="w-5 h-5" />
                    <span>Accept</span>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleDeclineMatch}
                    disabled={loading}
                    className="flex-1 font-semibold py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: 'var(--color-dark)',
                      color: 'var(--color-light)',
                    }}
                  >
                    <X className="w-5 h-5" />
                    <span>Decline</span>
                  </motion.button>
                </div>
              )}
            </motion.div>
          ) : !isInQueue && !matchFound ? (
            <motion.div
              key="join-queue"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <div className="text-center">
                <Users className="w-16 h-16 text-[color-mix(in_srgb,var(--color-fg)_40%,var(--color-bg)_60%)] mx-auto mb-4" />
                <h4 className="text-[var(--color-fg)] font-medium mb-2">Find an Opponent</h4>
                <p className="text-[color-mix(in_srgb,var(--color-fg)_60%,var(--color-bg)_40%)] text-sm mb-6">
                  Join the queue to find players with similar skill level
                </p>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleJoinQueue}
                disabled={loading || isUnderDeclinePenalty}
                className="w-full bg-[var(--color-dark-soft)] text-[var(--color-light)] hover:brightness-90 font-semibold py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Clock className="w-5 h-5" />
                  </motion.div>
                ) : (
                  <Play className="w-5 h-5" />
                )}
                <span>
                  {loading ? 'Joining...' : isUnderDeclinePenalty ? `Wait ${remainingPenaltyTime}s` : 'Find Match'}
                </span>
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
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="w-16 h-16 text-[var(--color-accent)] mx-auto mb-4"
                >
                  <Clock className="w-full h-full" />
                </motion.div>
                <h4 className="text-[var(--color-fg)] font-medium mb-2">Searching for Opponent</h4>
                <p className="text-[color-mix(in_srgb,var(--color-fg)_60%,var(--color-bg)_40%)] text-sm mb-4">
                  Looking for players with similar skill level...
                </p>
              </div>
              {/* Queue Info */}
              <div className="bg-[color-mix(in_srgb,var(--color-dark-soft)_80%,var(--color-bg)_20%)] rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[color-mix(in_srgb,var(--color-fg)_50%,var(--color-bg)_50%)] text-sm">Position in queue:</span>
                  <span className="text-[var(--color-fg)] font-medium">{queuePosition || 'Calculating...'}</span>
                </div>
                {estimatedWaitTime !== null && (
                  <div className="flex justify-between items-center">
                    <span className="text-[color-mix(in_srgb,var(--color-fg)_50%,var(--color-bg)_50%)] text-sm">Wait time:</span>
                    <span className="text-[var(--color-fg)] font-medium">{formatWaitTime(estimatedWaitTime)}</span>
                  </div>
                )}
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={leaveQueue}
                className="w-full bg-[var(--color-light-soft)] text-[var(--color-fg)] hover:brightness-90 font-semibold py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-all duration-200"
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
              className="mt-4 p-3 bg-[color-mix(in_srgb,red_20%,var(--color-bg)_80%)] border border-red-700 rounded-lg"
            >
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span className="text-red-400 text-sm">{error}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Decline Penalty Display */}
        <AnimatePresence>
          {isUnderDeclinePenalty && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-4 p-3 bg-[color-mix(in_srgb,orange_20%,var(--color-bg)_80%)] border border-orange-700 rounded-lg"
            >
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-orange-400" />
                <span className="text-orange-400 text-sm">Decline penalty: {remainingPenaltyTime}s remaining</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
} 