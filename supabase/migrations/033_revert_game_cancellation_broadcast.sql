-- Revert the game cancellation broadcast trigger
-- This removes the problematic broadcast that was interfering with acceptance flow

-- Drop the trigger and function
DROP TRIGGER IF EXISTS trigger_broadcast_game_cancellation ON games;
DROP FUNCTION IF EXISTS broadcast_game_cancellation(); 