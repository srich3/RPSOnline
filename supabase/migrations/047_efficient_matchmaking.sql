-- Implement efficient matchmaking with simple SELECT query
-- Instead of nested loops, use a direct query to find compatible players

-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS trigger_process_matchmaking ON game_queue;
DROP TRIGGER IF EXISTS test_simple_trigger ON game_queue;
DROP TRIGGER IF EXISTS simple_test_trigger ON game_queue;
DROP FUNCTION IF EXISTS process_matchmaking();
DROP FUNCTION IF EXISTS test_simple_trigger();
DROP FUNCTION IF EXISTS simple_test_trigger();

-- Create efficient matchmaking function
CREATE OR REPLACE FUNCTION process_matchmaking()
RETURNS TRIGGER AS $$
DECLARE
    compatible_player RECORD;
    game_id UUID;
BEGIN
    RAISE NOTICE '🎯 Efficient matchmaking triggered for user: % (rating: %)', NEW.user_id, NEW.rating;
    
    -- Temporarily disable RLS for this function
    SET LOCAL row_security = off;
    
    -- Find a compatible player with simple SELECT query
    -- Look for oldest player in queue with compatible rating (within 300 points)
    SELECT 
        q.user_id,
        q.rating,
        q.created_at
    INTO compatible_player
    FROM game_queue q
    WHERE q.user_id != NEW.user_id  -- Not the same player
    AND ABS(q.rating - NEW.rating) <= 300  -- Within 300 rating points
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

-- Create the efficient matchmaking trigger
CREATE TRIGGER trigger_process_matchmaking
    AFTER INSERT ON game_queue
    FOR EACH ROW
    EXECUTE FUNCTION process_matchmaking();

-- Create a function to test the efficient matchmaking
CREATE OR REPLACE FUNCTION test_efficient_matchmaking()
RETURNS TEXT AS $$
DECLARE
    test_user1 UUID;
    test_user2 UUID;
    result TEXT := '';
BEGIN
    -- Get two test users
    SELECT id INTO test_user1 FROM users LIMIT 1;
    SELECT id INTO test_user2 FROM users WHERE id != test_user1 LIMIT 1;
    
    IF test_user1 IS NULL OR test_user2 IS NULL THEN
        RETURN '❌ No users found for testing';
    END IF;
    
    result := '🧪 Testing efficient matchmaking with users: ' || test_user1 || ' and ' || test_user2 || E'\n';
    
    -- Clear queue
    DELETE FROM game_queue;
    result := result || '🧹 Cleared queue' || E'\n';
    
    -- Add first player
    INSERT INTO game_queue (user_id, rating) VALUES (test_user1, 100);
    result := result || '✅ Added first player (rating: 100)' || E'\n';
    
    -- Check queue
    SELECT result || '📋 Queue size after first player: ' || COUNT(*) INTO result FROM game_queue;
    
    -- Add second player (should trigger matchmaking)
    INSERT INTO game_queue (user_id, rating) VALUES (test_user2, 150);
    result := result || E'\n✅ Added second player (rating: 150)' || E'\n';
    
    -- Check queue again
    SELECT result || '📋 Queue size after second player: ' || COUNT(*) INTO result FROM game_queue;
    
    -- Check if any games were created
    SELECT result || E'\n🎮 Games created: ' || COUNT(*) INTO result FROM games WHERE status = 'waiting' AND created_at > NOW() - INTERVAL '1 minute';
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to manually process matchmaking for existing queue
CREATE OR REPLACE FUNCTION process_existing_queue()
RETURNS INTEGER AS $$
DECLARE
    player RECORD;
    compatible_player RECORD;
    game_id UUID;
    matches_created INTEGER := 0;
BEGIN
    RAISE NOTICE '🔄 Processing existing queue...';
    
    -- Temporarily disable RLS
    SET LOCAL row_security = off;
    
    -- Process each player in the queue
    FOR player IN 
        SELECT user_id, rating, created_at 
        FROM game_queue 
        ORDER BY created_at ASC
    LOOP
        -- Find a compatible player for this player
        SELECT 
            q.user_id,
            q.rating,
            q.created_at
        INTO compatible_player
        FROM game_queue q
        WHERE q.user_id != player.user_id
        AND ABS(q.rating - player.rating) <= 300
        AND NOT EXISTS (
            SELECT 1 FROM games g
            WHERE (g.player1_id = q.user_id OR g.player2_id = q.user_id)
            AND g.status IN ('waiting', 'active')
        )
        ORDER BY q.created_at ASC
        LIMIT 1;
        
        -- If we found a compatible player, create a game
        IF compatible_player.user_id IS NOT NULL THEN
            RAISE NOTICE '🎯 Creating match: % vs %', player.user_id, compatible_player.user_id;
            
            BEGIN
                INSERT INTO games (player1_id, player2_id, status, created_at, updated_at)
                VALUES (player.user_id, compatible_player.user_id, 'waiting', NOW(), NOW())
                RETURNING id INTO game_id;
                
                -- Remove both players from queue
                DELETE FROM game_queue 
                WHERE user_id IN (player.user_id, compatible_player.user_id);
                
                matches_created := matches_created + 1;
                
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE '❌ Failed to create game: %', SQLERRM;
            END;
        END IF;
    END LOOP;
    
    -- Re-enable RLS
    SET LOCAL row_security = on;
    
    RAISE NOTICE '✅ Processed existing queue, created % matches', matches_created;
    RETURN matches_created;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 