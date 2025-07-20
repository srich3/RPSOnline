-- Remove all triggers that use realtime.broadcast_changes (which doesn't exist)
-- This will clean up the system and prevent the broadcast errors

-- Drop all triggers that might use realtime.broadcast_changes
DROP TRIGGER IF EXISTS trigger_broadcast_game_changes ON games;
DROP TRIGGER IF EXISTS trigger_broadcast_match_creation ON games;
DROP TRIGGER IF EXISTS trigger_broadcast_game_cancellation ON games;
DROP TRIGGER IF EXISTS trigger_broadcast_game_updates ON games;
DROP TRIGGER IF EXISTS trigger_broadcast_match_declined ON games;

-- Drop all functions that use realtime.broadcast_changes
DROP FUNCTION IF EXISTS broadcast_game_changes();
DROP FUNCTION IF EXISTS broadcast_match_creation();
DROP FUNCTION IF EXISTS broadcast_game_cancellation();
DROP FUNCTION IF EXISTS broadcast_game_updates();
DROP FUNCTION IF EXISTS broadcast_match_declined();

-- Keep only the essential triggers and functions
-- The matchmaking system is working with the broadcast table approach

-- Verify what triggers are left
-- We should only have:
-- 1. trigger_process_matchmaking (for matchmaking)
-- 2. trigger_validate_game_creation (for game validation)
-- 3. trigger_test_simple (for testing)

-- Create a function to list all active triggers
CREATE OR REPLACE FUNCTION list_active_triggers()
RETURNS TABLE(
    trigger_name TEXT,
    table_name TEXT,
    function_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.trigger_name::TEXT,
        t.event_object_table::TEXT,
        p.proname::TEXT
    FROM information_schema.triggers t
    JOIN pg_proc p ON p.oid = t.action_statement::regproc
    WHERE t.trigger_schema = 'public'
    ORDER BY t.trigger_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 