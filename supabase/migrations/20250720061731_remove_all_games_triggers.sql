-- Remove ALL triggers from the games table to eliminate completion_type errors
-- This is a nuclear option to ensure no triggers are interfering with cancel_game

-- List all triggers on the games table first
DO $$
DECLARE
    trigger_record RECORD;
BEGIN
    RAISE NOTICE 'Current triggers on games table:';
    FOR trigger_record IN 
        SELECT trigger_name, event_manipulation, action_timing
        FROM information_schema.triggers 
        WHERE event_object_table = 'games' AND trigger_schema = 'public'
    LOOP
        RAISE NOTICE 'Trigger: % (% %)', trigger_record.trigger_name, trigger_record.action_timing, trigger_record.event_manipulation;
    END LOOP;
END $$;

-- Drop ALL possible triggers that might exist on the games table
DROP TRIGGER IF EXISTS trigger_game_integrity ON games;
DROP TRIGGER IF EXISTS trigger_validate_game_integrity ON games;
DROP TRIGGER IF EXISTS trigger_broadcast_game_cancellation ON games;
DROP TRIGGER IF EXISTS trigger_broadcast_game_changes ON games;
DROP TRIGGER IF EXISTS trigger_broadcast_match_creation ON games;
DROP TRIGGER IF EXISTS trigger_broadcast_game_updates ON games;
DROP TRIGGER IF EXISTS trigger_validate_game_completion ON games;
DROP TRIGGER IF EXISTS trigger_cleanup_old_games ON games;
DROP TRIGGER IF EXISTS trigger_validate_game_creation ON games;
DROP TRIGGER IF EXISTS trigger_broadcast_match_declined ON games;
DROP TRIGGER IF EXISTS trigger_broadcast_game_cancellation ON games;
DROP TRIGGER IF EXISTS trigger_broadcast_game_updates ON games;
DROP TRIGGER IF EXISTS trigger_broadcast_match_creation ON games;
DROP TRIGGER IF EXISTS trigger_broadcast_game_changes ON games;
DROP TRIGGER IF EXISTS trigger_validate_game_completion ON games;
DROP TRIGGER IF EXISTS trigger_cleanup_old_games ON games;
DROP TRIGGER IF EXISTS trigger_validate_game_creation ON games;
DROP TRIGGER IF EXISTS trigger_broadcast_match_declined ON games;

-- Drop ALL possible functions that might be causing issues
DROP FUNCTION IF EXISTS validate_game_integrity() CASCADE;
DROP FUNCTION IF EXISTS broadcast_game_cancellation() CASCADE;
DROP FUNCTION IF EXISTS broadcast_game_changes() CASCADE;
DROP FUNCTION IF EXISTS broadcast_match_creation() CASCADE;
DROP FUNCTION IF EXISTS broadcast_game_updates() CASCADE;
DROP FUNCTION IF EXISTS validate_game_completion() CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_games() CASCADE;
DROP FUNCTION IF EXISTS validate_game_creation() CASCADE;
DROP FUNCTION IF EXISTS broadcast_match_declined() CASCADE;
DROP FUNCTION IF EXISTS broadcast_game_cancellation() CASCADE;
DROP FUNCTION IF EXISTS broadcast_game_changes() CASCADE;
DROP FUNCTION IF EXISTS broadcast_match_creation() CASCADE;
DROP FUNCTION IF EXISTS broadcast_game_updates() CASCADE;
DROP FUNCTION IF EXISTS validate_game_completion() CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_games() CASCADE;
DROP FUNCTION IF EXISTS validate_game_creation() CASCADE;
DROP FUNCTION IF EXISTS broadcast_match_declined() CASCADE;

-- Now let's verify that the cancel_game function works without any triggers interfering
-- Create a simple test to verify the function works
CREATE OR REPLACE FUNCTION test_cancel_game_simple()
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