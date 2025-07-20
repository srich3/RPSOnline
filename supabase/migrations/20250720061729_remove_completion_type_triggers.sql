-- Remove any remaining triggers that reference the deprecated completion_type column
-- This will fix the error when canceling games

-- Drop all triggers that might reference completion_type
DROP TRIGGER IF EXISTS trigger_broadcast_game_cancellation ON games;
DROP TRIGGER IF EXISTS trigger_broadcast_game_changes ON games;
DROP TRIGGER IF EXISTS trigger_broadcast_match_creation ON games;
DROP TRIGGER IF EXISTS trigger_broadcast_game_updates ON games;
DROP TRIGGER IF EXISTS trigger_validate_game_completion ON games;
DROP TRIGGER IF EXISTS trigger_cleanup_old_games ON games;

-- Drop all functions that might reference completion_type
DROP FUNCTION IF EXISTS broadcast_game_cancellation();
DROP FUNCTION IF EXISTS broadcast_game_changes();
DROP FUNCTION IF EXISTS broadcast_match_creation();
DROP FUNCTION IF EXISTS broadcast_game_updates();
DROP FUNCTION IF EXISTS validate_game_completion();
DROP FUNCTION IF EXISTS cleanup_old_games();

-- Verify that the cancel_game function is working correctly
-- This should now work without any completion_type references 