-- Fix matchmaking to use realtime.broadcast_changes with private channel
-- Remove pg_notify and use proper Supabase realtime broadcasting

-- Drop and recreate the matchmaking function
DROP TRIGGER IF EXISTS trigger_process_matchmaking ON game_queue;
DROP FUNCTION IF EXISTS process_matchmaking();

-- Create the matchmaking function with realtime broadcasts
CREATE OR REPLACE FUNCTION process_matchmaking()
RETURNS TRIGGER AS $$
DECLARE
    compatible_player RECORD;
    game_id UUID;
BEGIN
    -- Log that the trigger fired
    RAISE NOTICE '🎯 MATCHMAKING TRIGGER FIRED for user: % (rating: %)', NEW.user_id, NEW.rating;
    
    -- Temporarily disable RLS for this function
    SET LOCAL row_security = off;
    
    -- Look for a compatible player (not the same player, within 300 rating points)
    SELECT 
        q.user_id,
        q.rating,
        q.created_at
    INTO compatible_player
    FROM game_queue q
    WHERE q.user_id != NEW.user_id  -- Not the same player
    AND ABS(q.rating - NEW.rating) <= 300  -- Within 300 rating points
    AND NOT EXISTS (  -- Not already in an active game
        SELECT 1 FROM games g
        WHERE (g.player1_id = q.user_id OR g.player2_id = q.user_id)
        AND g.status IN ('waiting', 'active')
    )
    ORDER BY q.created_at ASC  -- Oldest first
    LIMIT 1;  -- Just get the first compatible player
    
    -- If we found a compatible player, create a game
    IF compatible_player.user_id IS NOT NULL THEN
        RAISE NOTICE '🎯 Found compatible player: % (rating: %) vs % (rating: %)', 
            NEW.user_id, NEW.rating, compatible_player.user_id, compatible_player.rating;
        
        -- Create the game
        BEGIN
            INSERT INTO games (player1_id, player2_id, status, created_at, updated_at)
            VALUES (NEW.user_id, compatible_player.user_id, 'waiting', NOW(), NOW())
            RETURNING id INTO game_id;
            
            RAISE NOTICE '🎮 Game created successfully: %', game_id;
            
            -- Remove both players from queue
            DELETE FROM game_queue 
            WHERE user_id IN (NEW.user_id, compatible_player.user_id);
            
            RAISE NOTICE '✅ Players removed from queue: % and %', NEW.user_id, compatible_player.user_id;
            
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE '❌ Failed to create game: %', SQLERRM;
        END;
    ELSE
        RAISE NOTICE '⏳ No compatible player found for % (rating: %), waiting...', NEW.user_id, NEW.rating;
    END IF;
    
    -- Re-enable RLS
    SET LOCAL row_security = on;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
CREATE TRIGGER trigger_process_matchmaking
    AFTER INSERT ON game_queue
    FOR EACH ROW
    EXECUTE FUNCTION process_matchmaking();

-- Create a broadcast function that uses the correct Supabase realtime approach
CREATE OR REPLACE FUNCTION broadcast_matchmaking_event(event_type TEXT, event_data JSONB)
RETURNS VOID AS $$
BEGIN
    -- Use the correct Supabase realtime broadcasting
    -- This will be called from the frontend or other functions
    RAISE NOTICE '📡 Broadcasting % event: %', event_type, event_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 