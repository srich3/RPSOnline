-- Update match creation broadcast to include opponent usernames
-- This will allow clients to see opponent usernames before accepting matches

-- Drop the existing trigger first
DROP TRIGGER IF EXISTS trigger_broadcast_match_creation ON games;

-- Drop the existing function
DROP FUNCTION IF EXISTS broadcast_match_creation();

-- Create an updated function that includes opponent usernames
CREATE OR REPLACE FUNCTION broadcast_match_creation()
RETURNS TRIGGER AS $$
DECLARE
    player1_username TEXT;
    player2_username TEXT;
    broadcast_payload JSONB;
BEGIN
    -- Broadcast when a new game is created (INSERT operation)
    IF TG_OP = 'INSERT' AND NEW.status = 'waiting' THEN
        
        -- Get usernames for both players
        SELECT username INTO player1_username 
        FROM users 
        WHERE id = NEW.player1_id;
        
        SELECT username INTO player2_username 
        FROM users 
        WHERE id = NEW.player2_id;
        
        -- Create a custom payload with game data and usernames
        broadcast_payload := jsonb_build_object(
            'game_id', NEW.id,
            'player1_id', NEW.player1_id,
            'player1_username', player1_username,
            'player2_id', NEW.player2_id,
            'player2_username', player2_username,
            'status', NEW.status,
            'created_at', NEW.created_at
        );
        
        -- Broadcast the match creation event using Supabase Realtime
        PERFORM realtime.broadcast_changes(
            'matchmaking',                                    -- topic - broadcast to matchmaking channel
            'match_found',                                    -- event - custom event type
            'INSERT',                                         -- operation - INSERT
            TG_TABLE_NAME,                                    -- table - games
            TG_TABLE_SCHEMA,                                  -- schema - public
            broadcast_payload,                                -- custom payload with usernames
            NULL                                              -- old record - NULL for INSERT
        );
        
        RAISE NOTICE 'Broadcasted match creation for game % with usernames: % vs %', 
            NEW.id, player1_username, player2_username;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger for the updated function
CREATE TRIGGER trigger_broadcast_match_creation
    AFTER INSERT ON games
    FOR EACH ROW
    EXECUTE FUNCTION broadcast_match_creation(); 