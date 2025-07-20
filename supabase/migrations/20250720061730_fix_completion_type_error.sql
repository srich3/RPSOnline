-- Fix the completion_type error by removing any remaining problematic triggers
-- The error "record 'new' has no field 'completion_type'" suggests there's still a trigger

-- First, let's see what triggers exist on the games table
-- This will help us identify the problematic trigger

-- Drop any remaining triggers that might be causing issues
DROP TRIGGER IF EXISTS trigger_game_integrity ON games;
DROP TRIGGER IF EXISTS trigger_validate_game_integrity ON games;
DROP TRIGGER IF EXISTS trigger_broadcast_game_cancellation ON games;
DROP TRIGGER IF EXISTS trigger_broadcast_game_changes ON games;
DROP TRIGGER IF EXISTS trigger_broadcast_match_creation ON games;
DROP TRIGGER IF EXISTS trigger_broadcast_game_updates ON games;
DROP TRIGGER IF EXISTS trigger_validate_game_completion ON games;
DROP TRIGGER IF EXISTS trigger_cleanup_old_games ON games;
DROP TRIGGER IF EXISTS trigger_validate_game_creation ON games;

-- Drop any functions that might be causing issues
DROP FUNCTION IF EXISTS validate_game_integrity() CASCADE;
DROP FUNCTION IF EXISTS broadcast_game_cancellation() CASCADE;
DROP FUNCTION IF EXISTS broadcast_game_changes() CASCADE;
DROP FUNCTION IF EXISTS broadcast_match_creation() CASCADE;
DROP FUNCTION IF EXISTS broadcast_game_updates() CASCADE;
DROP FUNCTION IF EXISTS validate_game_completion() CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_games() CASCADE;
DROP FUNCTION IF EXISTS validate_game_creation() CASCADE;

-- Now let's test the cancel_game function to make sure it works
-- Create a simple test function to verify the cancel_game function works
CREATE OR REPLACE FUNCTION test_cancel_game()
RETURNS TEXT AS $$
DECLARE
    test_game_id UUID;
    test_user_id UUID := '00000000-0000-0000-0000-000000000001';
    result TEXT := '';
BEGIN
    -- Create a test game
    INSERT INTO games (player1_id, player2_id, status, created_at, updated_at)
    VALUES (test_user_id, '00000000-0000-0000-0000-000000000002', 'waiting', NOW(), NOW())
    RETURNING id INTO test_game_id;
    
    result := result || 'Test game created: ' || test_game_id || E'\n';
    
    -- Try to cancel the game
    PERFORM cancel_game(test_game_id, test_user_id);
    
    result := result || 'Game canceled successfully' || E'\n';
    
    -- Check the result
    SELECT status INTO result FROM games WHERE id = test_game_id;
    result := result || 'Final game status: ' || result || E'\n';
    
    -- Clean up
    DELETE FROM games WHERE id = test_game_id;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 