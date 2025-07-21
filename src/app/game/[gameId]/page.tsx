"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { useGameStore } from '../../../store/gameStore';
import { useRealTimeGame } from '../../../hooks/useRealTimeGame';
import GameRoom from '../../../components/game/GameRoom';
import LoadingOverlay from '../../../components/ui/LoadingOverlay';
import type { Game } from '../../../types/database';

interface GamePageProps {
  params: Promise<{ gameId: string }>;
}

const GamePage: React.FC<GamePageProps> = ({ params }) => {
  const { gameId } = React.use(params);
  const router = useRouter();
  const { user, profile } = useAuth();
  const { startNewGame } = useGameStore();
  
  const [gameData, setGameData] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameStarted, setGameStarted] = useState(false);

  // Initialize real-time game connection
  const realTimeGame = useRealTimeGame({
    gameId,
    autoReconnect: true,
    maxReconnectAttempts: 5,
  });

  // Load game data from database
  useEffect(() => {
    const loadGameData = async () => {
      if (!gameId || !user?.id) return;

      console.log(`🎮 Loading game data for game: ${gameId}`);
      setLoading(true);
      setError(null);

      try {
        const { data: game, error: gameError } = await supabase
          .from('games')
          .select('*')
          .eq('id', gameId)
          .single();

        if (gameError) {
          console.error('❌ Error loading game:', gameError);
          setError('Game not found or access denied');
          setLoading(false);
          return;
        }

        if (!game) {
          setError('Game not found');
          setLoading(false);
          return;
        }

        // Check if user is part of this game
        if (game.player1_id !== user.id && game.player2_id !== user.id) {
          setError('You are not part of this game');
          setLoading(false);
          return;
        }

        console.log('✅ Game data loaded:', game);
        setGameData(game);

        // If game is already active, start it in the game store
        if (game.status === 'active') {
          console.log('🎮 Game is already active, initializing game store');
          startNewGame(game.player1_id, game.player2_id || '');
          setGameStarted(true);
        }

        setLoading(false);

      } catch (error) {
        console.error('❌ Error loading game data:', error);
        setError('Failed to load game data');
        setLoading(false);
      }
    };

    loadGameData();
  }, [gameId, user?.id, startNewGame]);

  // Listen for game status changes
  useEffect(() => {
    if (!gameData) return;

    // Subscribe to game status changes
    const gameSubscription = supabase
      .channel(`game-status:${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          console.log('📡 Game status update received:', payload);
          const updatedGame = payload.new as Game;
          
          if (updatedGame.status === 'active' && !gameStarted) {
            console.log('🎮 Game is now active, initializing game store');
            startNewGame(updatedGame.player1_id, updatedGame.player2_id || '');
            setGameStarted(true);
          }
        }
      )
      .subscribe();

    return () => {
      gameSubscription.unsubscribe();
    };
  }, [gameId, gameData, gameStarted, startNewGame]);

  // Handle game cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('🧹 Cleaning up game data on unmount');
    };
  }, []);

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-black mb-4">Loading Game...</div>
          <div className="text-gray-600">Please wait while we connect you to the game.</div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600 mb-4">Error</div>
          <div className="text-gray-600 mb-6">{error}</div>
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-black text-white px-6 py-3 font-bold tracking-wide uppercase hover:bg-gray-800 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Show game room with loading overlay until game is active
  return (
    <div className="min-h-screen bg-white">
      <GameRoom 
        gameId={gameId} 
        className="h-screen"
      />
      
      {/* Show loading overlay until game is active */}
      <LoadingOverlay 
        show={!gameStarted || gameData?.status !== 'active'} 
        showCloseButton={false}
      />
    </div>
  );
};

export default GamePage; 