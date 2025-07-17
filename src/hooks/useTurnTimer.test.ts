import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useTurnTimer } from './useTurnTimer';
import { useGameStore } from '../store/gameStore';
import { GAME_CONSTANTS } from '../utils/gameLogic';

// Mock the game store
vi.mock('../store/gameStore', () => ({
  useGameStore: vi.fn()
}));

describe('useTurnTimer', () => {
  const mockUseGameStore = useGameStore as any;
  
  beforeEach(() => {
    vi.useFakeTimers();
    mockUseGameStore.mockReturnValue({
      timeRemaining: 30,
      updateTimeRemaining: vi.fn(),
      submitTurn: vi.fn(),
      isMyTurn: true,
      gameStatus: 'active'
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should format time correctly', () => {
    const { result } = renderHook(() => useTurnTimer());
    
    expect(result.current.formatTime(65)).toBe('01:05');
    expect(result.current.formatTime(30)).toBe('00:30');
    expect(result.current.formatTime(0)).toBe('00:00');
  });

  it('should get correct timer status', () => {
    const { result } = renderHook(() => useTurnTimer());
    
    expect(result.current.getTimerStatus()).toBe('normal');
    
    // Test warning status
    mockUseGameStore.mockReturnValue({
      timeRemaining: 8,
      updateTimeRemaining: vi.fn(),
      submitTurn: vi.fn(),
      isMyTurn: true,
      gameStatus: 'active'
    });
    
    const { result: result2 } = renderHook(() => useTurnTimer());
    expect(result2.current.getTimerStatus()).toBe('warning');
    
    // Test critical status
    mockUseGameStore.mockReturnValue({
      timeRemaining: 3,
      updateTimeRemaining: vi.fn(),
      submitTurn: vi.fn(),
      isMyTurn: true,
      gameStatus: 'active'
    });
    
    const { result: result3 } = renderHook(() => useTurnTimer());
    expect(result3.current.getTimerStatus()).toBe('critical');
  });

  it('should calculate progress percentage correctly', () => {
    const { result } = renderHook(() => useTurnTimer());
    
    expect(result.current.getProgressPercentage(30)).toBe(0);
    expect(result.current.getProgressPercentage(15)).toBe(50);
    expect(result.current.getProgressPercentage(0)).toBe(100);
  });

  it('should be active when it is my turn and game is active', () => {
    const { result } = renderHook(() => useTurnTimer());
    
    expect(result.current.isActive).toBe(true);
    
    // Test inactive when not my turn
    mockUseGameStore.mockReturnValue({
      timeRemaining: 30,
      updateTimeRemaining: vi.fn(),
      submitTurn: vi.fn(),
      isMyTurn: false,
      gameStatus: 'active'
    });
    
    const { result: result2 } = renderHook(() => useTurnTimer());
    expect(result2.current.isActive).toBe(false);
  });

  it('should return correct TURN_TIME_LIMIT', () => {
    const { result } = renderHook(() => useTurnTimer());
    
    expect(result.current.TURN_TIME_LIMIT).toBe(GAME_CONSTANTS.TURN_TIME_LIMIT);
  });
}); 