-- Fix the broadcast format to use the original table record format
-- realtime.broadcast_changes expects the actual table record, not custom JSONB

-- Drop the existing trigger and function
DROP TRIGGER IF EXISTS trigger_broadcast_match_creation ON games;
DROP FUNCTION IF EXISTS broadcast_match_creation();

-- Create the function with the correct broadcast format
CREATE OR REPLACE FUNCTION broadcast_match_creation()
RETURNS TRIGGER AS $$
BEGIN
    -- Broadcast when a new game is created (INSERT operation)
    IF TG_OP = 'INSERT' AND NEW.status = 'waiting' THEN
        
        -- Broadcast the match creation event using Supabase Realtime
        -- Use the actual game record (NEW) as expected by realtime.broadcast_changes
        PERFORM realtime.broadcast_changes(
            'matchmaking',                                    -- topic - broadcast to matchmaking channel
            'match_found',                                    -- event - custom event type
            'INSERT',                                         -- operation - INSERT
            TG_TABLE_NAME,                                    -- table - games
            TG_TABLE_SCHEMA,                                  -- schema - public
            NEW,                                              -- new record - actual game record
            NULL                                              -- old record - NULL for INSERT
        );
        
        RAISE NOTICE 'Broadcasted match creation for game %', NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER trigger_broadcast_match_creation
    AFTER INSERT ON games
    FOR EACH ROW
    EXECUTE FUNCTION broadcast_match_creation(); 