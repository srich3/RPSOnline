-- Remove all triggers and functions to get a clean slate
-- This will remove everything so we can start fresh

-- Drop all triggers
DROP TRIGGER IF EXISTS trigger_process_matchmaking ON game_queue;
DROP TRIGGER IF EXISTS trigger_validate_game_completion ON games;
DROP TRIGGER IF EXISTS trigger_broadcast_game_changes ON games;
DROP TRIGGER IF EXISTS trigger_cleanup_old_games ON games;
DROP TRIGGER IF EXISTS trigger_validate_game_creation ON games;
DROP TRIGGER IF EXISTS trigger_broadcast_match_creation ON games;
DROP TRIGGER IF EXISTS trigger_broadcast_game_cancellation ON games;
DROP TRIGGER IF EXISTS trigger_broadcast_game_updates ON games;

-- Drop all functions
DROP FUNCTION IF EXISTS process_matchmaking();
DROP FUNCTION IF EXISTS validate_game_completion();
DROP FUNCTION IF EXISTS broadcast_game_changes();
DROP FUNCTION IF EXISTS cleanup_old_games();
DROP FUNCTION IF EXISTS validate_game_creation();
DROP FUNCTION IF EXISTS broadcast_match_creation();
DROP FUNCTION IF EXISTS broadcast_game_cancellation();
DROP FUNCTION IF EXISTS broadcast_game_updates();
DROP FUNCTION IF EXISTS cancel_game(UUID, UUID);
DROP FUNCTION IF EXISTS forfeit_game(UUID, UUID);
DROP FUNCTION IF EXISTS get_player_achievement_stats(UUID);
DROP FUNCTION IF EXISTS cleanup_queue_for_active_players();
DROP FUNCTION IF EXISTS test_matchmaking_trigger();
DROP FUNCTION IF EXISTS manual_process_matchmaking(UUID, UUID);

-- Clean slate achieved 