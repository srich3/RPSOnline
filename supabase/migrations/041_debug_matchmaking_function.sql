-- Debug and fix the matchmaking function to ensure it properly creates games
-- The current function might have issues with the trigger logic

-- Drop the existing trigger and function
DROP TRIGGER IF EXISTS trigger_process_matchmaking ON game_queue;
DROP FUNCTION IF EXISTS process_matchmaking;

-- Create a simplified and more robust matchmaking function
CREATE OR REPLACE FUNCTION process_matchmaking()
RETURNS TRIGGER AS $$
DECLARE
    player1 RECORD;
    player2 RECORD;
    game_id UUID;
    match_found BOOLEAN := FALSE;
BEGIN
    -- Temporarily disable RLS for this function to access all queue entries
    SET LOCAL row_security = off;
    
    RAISE NOTICE '🎯 Matchmaking triggered for user: %', NEW.user_id;
    
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

-- Also create a manual matchmaking function for testing
CREATE OR REPLACE FUNCTION manual_process_matchmaking()
RETURNS INTEGER AS $$
DECLARE
    player1 RECORD;
    player2 RECORD;
    game_id UUID;
    matches_created INTEGER := 0;
BEGIN
    -- Temporarily disable RLS for this function to access all queue entries
    SET LOCAL row_security = off;
    
    RAISE NOTICE '🎯 Manual matchmaking started';
    
    -- Get all players in queue with their ratings
    FOR player1 IN 
        SELECT 
            q.user_id,
            q.created_at,
            q.rating
        FROM game_queue q
        ORDER BY q.created_at ASC
    LOOP
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
                    
                    matches_created := matches_created + 1;
                    
                    -- Exit the inner loop since we found a match for player1
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
    
    RAISE NOTICE '🏁 Manual matchmaking completed, created % matches', matches_created;
    
    RETURN matches_created;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 