import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { supabase } from '../lib/supabase';
import { 
  findMatch, 
  createGame, 
  removePlayersFromQueue,
  getQueueStats 
} from './matchmaking';

// Mock Supabase for testing
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn()
  }
}));

describe('Matchmaking Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Note: calculateMatchScore is not exported, so we can't test it directly
  // The function is tested indirectly through findMatch functionality

  describe('findMatch', () => {
    it('should return null when no players in queue', async () => {
      const mockSupabase = vi.mocked(supabase);
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          neq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null })
            })
          })
        })
      } as any);

      const result = await findMatch('player1', 1000);
      expect(result).toBeNull();
    });

    it('should return match when suitable opponent found', async () => {
      const mockQueueData = [
        {
          user_id: 'player2',
          created_at: new Date().toISOString(),
          users: {
            id: 'player2',
            username: 'testuser',
            rating: 1005
          }
        }
      ];

      const mockSupabase = vi.mocked(supabase);
      const mockSelect = vi.fn().mockReturnValue({
        neq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockQueueData, error: null })
          })
        })
      });
      
      mockSupabase.from.mockReturnValue({
        select: mockSelect
      } as any);

      const result = await findMatch('player1', 1000);
      
      // The function should find a match since the rating difference is within range
      expect(result).not.toBeNull();
      if (result) {
        expect(result.player1_id).toBe('player1');
        expect(result.player2_id).toBe('player2');
        expect(result.player1_rating).toBe(1000);
        expect(result.player2_rating).toBe(1005);
        expect(result.rating_difference).toBe(5);
      }
    });
  });

  describe('createGame', () => {
    it('should create game with correct data', async () => {
      const mockGame = {
        id: 'game1',
        player1_id: 'player1',
        player2_id: 'player2',
        status: 'waiting',

        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const mockSupabase = vi.mocked(supabase);
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockGame, error: null })
          })
        })
      } as any);

      const match = {
        player1_id: 'player1',
        player2_id: 'player2',
        player1_rating: 1000,
        player2_rating: 1005,
        rating_difference: 5
      };

      const result = await createGame(match);
      
      expect(result).toEqual(mockGame);
      expect(mockSupabase.from).toHaveBeenCalledWith('games');
    });
  });

  describe('removePlayersFromQueue', () => {
    it('should remove players from queue', async () => {
      const mockSupabase = vi.mocked(supabase);
      mockSupabase.from.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ error: null })
        })
      } as any);

      const result = await removePlayersFromQueue(['player1', 'player2']);
      
      expect(result).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('game_queue');
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      const mockQueueData = [
        { created_at: new Date(Date.now() - 30000).toISOString() }, // 30 seconds ago
        { created_at: new Date(Date.now() - 60000).toISOString() }, // 60 seconds ago
      ];

      const mockSupabase = vi.mocked(supabase);
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: mockQueueData, error: null })
      } as any);

      const result = await getQueueStats();
      
      expect(result.totalPlayers).toBe(2);
      expect(result.averageWaitTime).toBeGreaterThan(0);
      expect(result.longestWaitTime).toBeGreaterThan(0);
    });

    it('should return zero stats when queue is empty', async () => {
      const mockSupabase = vi.mocked(supabase);
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: [], error: null })
      } as any);

      const result = await getQueueStats();
      
      expect(result).toEqual({
        totalPlayers: 0,
        averageWaitTime: 0,
        longestWaitTime: 0
      });
    });
  });
}); 