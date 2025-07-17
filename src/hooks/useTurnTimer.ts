import { useEffect, useCallback, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { GAME_CONSTANTS } from '../utils/gameLogic';

const TURN_TIME_LIMIT = GAME_CONSTANTS.TURN_TIME_LIMIT;

export function useTurnTimer() {
  const { 
    timeRemaining, 
    updateTimeRemaining, 
    submitTurn, 
    isMyTurn,
    gameStatus 
  } = useGameStore();
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Start countdown timer
  const startTimer = useCallback(() => {
    if (!isMyTurn || gameStatus !== 'active') {
      clearTimers();
      return;
    }

    // Clear any existing timers
    clearTimers();

    // Start countdown interval
    intervalRef.current = setInterval(() => {
      const currentTime = useGameStore.getState().timeRemaining;
      
      if (currentTime > 0) {
        updateTimeRemaining(currentTime - 1);
      } else {
        // Time's up - auto submit turn
        clearTimers();
        submitTurn();
      }
    }, 1000);
  }, [isMyTurn, gameStatus, updateTimeRemaining, submitTurn, clearTimers]);

  // Stop timer
  const stopTimer = useCallback(() => {
    clearTimers();
  }, [clearTimers]);

  // Reset timer to full duration
  const resetTimer = useCallback(() => {
    updateTimeRemaining(TURN_TIME_LIMIT);
  }, [updateTimeRemaining]);

  // Pause timer (for when game is paused)
  const pauseTimer = useCallback(() => {
    clearTimers();
  }, [clearTimers]);

  // Resume timer
  const resumeTimer = useCallback(() => {
    if (isMyTurn && gameStatus === 'active' && timeRemaining > 0) {
      startTimer();
    }
  }, [isMyTurn, gameStatus, timeRemaining, startTimer]);

  // Format time as MM:SS
  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Get timer status
  const getTimerStatus = useCallback(() => {
    if (!isMyTurn) return 'waiting';
    if (timeRemaining <= 0) return 'expired';
    if (timeRemaining <= 5) return 'critical';
    if (timeRemaining <= 10) return 'warning';
    return 'normal';
  }, [isMyTurn, timeRemaining]);

  // Get progress percentage
  const getProgressPercentage = useCallback((time: number): number => {
    return ((TURN_TIME_LIMIT - time) / TURN_TIME_LIMIT) * 100;
  }, []);

  // Set up timer when turn changes
  useEffect(() => {
    if (isMyTurn && gameStatus === 'active') {
      startTimer();
    } else {
      stopTimer();
    }

    // Cleanup on unmount
    return () => {
      clearTimers();
    };
  }, [isMyTurn, gameStatus, startTimer, stopTimer, clearTimers]);

  // Handle game status changes
  useEffect(() => {
    if (gameStatus === 'active' && isMyTurn) {
      resumeTimer();
    } else {
      pauseTimer();
    }
  }, [gameStatus, isMyTurn, resumeTimer, pauseTimer]);

  return {
    timeRemaining,
    formatTime,
    getTimerStatus,
    getProgressPercentage,
    startTimer,
    stopTimer,
    resetTimer,
    pauseTimer,
    resumeTimer,
    isActive: isMyTurn && gameStatus === 'active',
    TURN_TIME_LIMIT
  };
} 