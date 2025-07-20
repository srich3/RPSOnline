-- Add trigger to broadcast when a new game is created (match found)
-- This will allow players to see when a match is found in real-time

-- Create a function to broadcast match creation using realtime.broadcast_changes
CREATE OR REPLACE FUNCTION broadcast_match_creation()
RETURNS TRIGGER AS $$
BEGIN
    -- Broadcast when a new game is created (INSERT operation)
    IF TG_OP = 'INSERT' AND NEW.status = 'waiting' THEN
        
        -- Broadcast the match creation event using Supabase Realtime
        PERFORM realtime.broadcast_changes(
            'matchmaking',                                    -- topic - broadcast to matchmaking channel
            'match_found',                                    -- event - custom event type
            'INSERT',                                         -- operation - INSERT
            TG_TABLE_NAME,                                    -- table - games
            TG_TABLE_SCHEMA,                                  -- schema - public
            NEW,                                              -- new record - created game
            NULL                                              -- old record - NULL for INSERT
        );
        
        RAISE NOTICE 'Broadcasted match creation for game %', NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for the match creation broadcast function
CREATE TRIGGER trigger_broadcast_match_creation
    AFTER INSERT ON games
    FOR EACH ROW
    EXECUTE FUNCTION broadcast_match_creation(); 