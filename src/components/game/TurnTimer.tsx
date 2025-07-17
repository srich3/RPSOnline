'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { useTurnTimer } from '../../hooks/useTurnTimer';
import { useGameStore } from '../../store/gameStore';
import { GAME_CONSTANTS } from '../../utils/gameLogic';

interface TurnTimerProps {
  className?: string;
}

const WARNING_THRESHOLD = 10;
const CRITICAL_THRESHOLD = 5;
const TURN_TIME_LIMIT = GAME_CONSTANTS.TURN_TIME_LIMIT;

export default function TurnTimer({ className = '' }: TurnTimerProps) {
  const {
    timeRemaining,
    formatTime,
    getTimerStatus,
    getProgressPercentage,
    TURN_TIME_LIMIT: timerLimit
  } = useTurnTimer();
  const boardState = useGameStore((s) => s.boardState);
  const currentTurn = useGameStore((s) => s.currentTurn);
  const currentGame = useGameStore((s) => s.currentGame);

  // Determine if this player has submitted
  let hasSubmitted = false;
  let opponentSubmitted = false;
  let isPlayer1 = false;
  let isPlayer2 = false;
  let opponentName = 'Opponent';
  if (currentGame && currentTurn && boardState) {
    isPlayer1 = currentTurn.player_id === currentGame.player1_id;
    isPlayer2 = currentTurn.player_id === currentGame.player2_id;
    if (isPlayer1) {
      hasSubmitted = boardState.player1_submitted;
      opponentSubmitted = boardState.player2_submitted;
    } else if (isPlayer2) {
      hasSubmitted = boardState.player2_submitted;
      opponentSubmitted = boardState.player1_submitted;
    }
  }

  const timerStatus = getTimerStatus();

  // Get timer color based on status
  const getTimerColor = (status: string): string => {
    switch (status) {
      case 'critical':
      case 'expired':
        return 'text-red-500';
      case 'warning':
        return 'text-yellow-500';
      case 'normal':
        return 'text-green-400';
      default:
        return 'text-gray-400';
    }
  };

  // Get timer background color
  const getTimerBgColor = (status: string): string => {
    switch (status) {
      case 'critical':
      case 'expired':
        return 'bg-red-500/20 border-red-500/30';
      case 'warning':
        return 'bg-yellow-500/20 border-yellow-500/30';
      case 'normal':
        return 'bg-green-500/20 border-green-500/30';
      default:
        return 'bg-gray-800/50 border-gray-700';
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={`relative overflow-hidden rounded-lg p-4 ${getTimerBgColor(timerStatus)} border ${className}`}
      >
        {/* Progress bar */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-20" />
        <div
          className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-green-400 via-yellow-400 to-red-500 transition-all duration-1000 ease-linear"
          style={{ width: `${getProgressPercentage(timeRemaining)}%` }}
        />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Clock className={`w-5 h-5 ${getTimerColor(timerStatus)}`} />
              <span className={`text-sm font-medium ${getTimerColor(timerStatus)}`}>
                Turn Timer
              </span>
            </div>
            {/* Warning icon for low time */}
            {timerStatus === 'warning' || timerStatus === 'critical' ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex items-center space-x-1"
              >
                <AlertTriangle className={`w-4 h-4 ${getTimerColor(timerStatus)}`} />
                <span className={`text-xs font-medium ${getTimerColor(timerStatus)}`}>
                  {timerStatus === 'critical' ? 'HURRY!' : 'Time running out!'}
                </span>
              </motion.div>
            ) : null}
          </div>

          {/* Timer display */}
          <div className="text-center">
            <motion.div
              key={timeRemaining}
              initial={{ scale: 1.2, opacity: 0.8 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2 }}
              className={`text-3xl font-bold font-mono ${getTimerColor(timerStatus)}`}
            >
              {formatTime(timeRemaining)}
            </motion.div>
            <div className="mt-1 text-xs text-gray-400">
              {timeRemaining > 0 ? `${timeRemaining} seconds remaining` : "Time's up!"}
            </div>
          </div>

          {/* Visual countdown indicator */}
          <div className="mt-3 flex justify-center">
            <div className="flex space-x-1">
              {Array.from({ length: 10 }, (_, i) => (
                <motion.div
                  key={i}
                  className={`h-1 w-2 rounded-full transition-all duration-300 ${
                    i < Math.ceil((timeRemaining / TURN_TIME_LIMIT) * 10)
                      ? 'bg-green-400'
                      : 'bg-gray-600'
                  }`}
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                />
              ))}
            </div>
          </div>

          {/* Submission status */}
          {hasSubmitted && !opponentSubmitted && (
            <div className="mt-4 flex items-center justify-center text-yellow-500 text-sm font-medium">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Waiting for opponent to submit...
            </div>
          )}
          {!hasSubmitted && (
            <div className="mt-4 flex items-center justify-center text-blue-400 text-xs font-medium">
              Plan and submit your moves before the timer runs out!
            </div>
          )}
          {hasSubmitted && opponentSubmitted && (
            <div className="mt-4 flex items-center justify-center text-green-500 text-xs font-medium">
              Both players have submitted. Resolving turn...
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
} 