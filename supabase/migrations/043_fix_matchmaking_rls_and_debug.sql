-- Fix potential RLS issues and add more debugging to matchmaking
-- The trigger might not be working due to RLS or other issues

-- Drop and recreate the matchmaking function with better RLS handling
DROP TRIGGER IF EXISTS trigger_process_matchmaking ON game_queue;
DROP FUNCTION IF EXISTS process_matchmaking;

CREATE OR REPLACE FUNCTION process_matchmaking()
RETURNS TRIGGER AS $$
DECLARE
    player1 RECORD;
    player2 RECORD;
    game_id UUID;
    match_found BOOLEAN := FALSE;
    queue_count INTEGER;
BEGIN
    -- Get queue count for debugging
    SELECT COUNT(*) INTO queue_count FROM game_queue;
    RAISE NOTICE '🎯 Matchmaking triggered for user: % (Queue size: %)', NEW.user_id, queue_count;
    
    -- Temporarily disable RLS for this function to access all queue entries
    SET LOCAL row_security = off;
    
    -- Get all players in queue with their ratings
    FOR player1 IN 
        SELECT 
            q.user_id,
            q.created_at,
            q.rating
        FROM game_queue q
        ORDER BY q.created_at ASC
    LOOP
        -- Skip if we already found a match
        IF match_found THEN
            EXIT;
        END IF;
        
        RAISE NOTICE '🔍 Checking player1: % (rating: %)', player1.user_id, player1.rating;
        
        -- Look for a suitable opponent within rating range
        FOR player2 IN 
            SELECT 
                q.user_id,
                q.created_at,
                q.rating
            FROM game_queue q
            WHERE q.user_id != player1.user_id
            AND ABS(q.rating - player1.rating) <= 300  -- Within 300 rating points
            ORDER BY q.created_at ASC
        LOOP
            -- Skip if we already found a match
            IF match_found THEN
                EXIT;
            END IF;
            
            RAISE NOTICE '🎯 Found potential match: % (rating: %) vs % (rating: %)', 
                player1.user_id, player1.rating, player2.user_id, player2.rating;
            
            -- Check if either player is already in an active game
            IF NOT EXISTS (
                SELECT 1 FROM games 
                WHERE (player1_id IN (player1.user_id, player2.user_id) 
                       OR player2_id IN (player1.user_id, player2.user_id))
                AND status IN ('waiting', 'active')
            ) THEN
                RAISE NOTICE '✅ Players not in active games, creating match...';
                
                -- Create a game
                BEGIN
                    INSERT INTO games (player1_id, player2_id, status, created_at, updated_at)
                    VALUES (player1.user_id, player2.user_id, 'waiting', NOW(), NOW())
                    RETURNING id INTO game_id;
                    
                    RAISE NOTICE '🎮 Game created successfully: %', game_id;
                    
                    -- Remove both players from queue
                    DELETE FROM game_queue WHERE user_id IN (player1.user_id, player2.user_id);
                    
                    RAISE NOTICE '✅ Players removed from queue: % and %', player1.user_id, player2.user_id;
                    
                    -- Mark that we found a match
                    match_found := TRUE;
                    
                    -- Exit the inner loop
                    EXIT;
                    
                EXCEPTION
                    WHEN OTHERS THEN
                        -- If game creation fails, log the error and continue
                        RAISE NOTICE '❌ Failed to create game for % vs %: %', player1.user_id, player2.user_id, SQLERRM;
                        CONTINUE;
                END;
            ELSE
                RAISE NOTICE '⚠️ One or both players already in active game, removing from queue';
                -- One or both players are already in an active game, remove them from queue
                DELETE FROM game_queue WHERE user_id IN (player1.user_id, player2.user_id);
            END IF;
        END LOOP;
    END LOOP;
    
    -- Re-enable RLS
    SET LOCAL row_security = on;
    
    RAISE NOTICE '🏁 Matchmaking process completed';
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER trigger_process_matchmaking
    AFTER INSERT ON game_queue
    FOR EACH ROW
    EXECUTE FUNCTION process_matchmaking();

-- Also create a simple test function to manually add players to queue
CREATE OR REPLACE FUNCTION test_add_player_to_queue(test_user_id UUID, test_rating INTEGER DEFAULT 100)
RETURNS BOOLEAN AS $$
BEGIN
    -- Insert a test player into the queue
    INSERT INTO game_queue (user_id, rating) VALUES (test_user_id, test_rating);
    RAISE NOTICE '✅ Added test player % with rating % to queue', test_user_id, test_rating;
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ Failed to add test player: %', SQLERRM;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to clear the queue for testing
CREATE OR REPLACE FUNCTION clear_queue_for_testing()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM game_queue;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '🧹 Cleared queue, removed % entries', deleted_count;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 