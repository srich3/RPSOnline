-- Create simple matchmaking system with broadcasts
-- Player joins queue -> trigger fires -> function finds match -> creates game -> broadcasts updates

-- Create the matchmaking function
CREATE OR REPLACE FUNCTION process_matchmaking()
RETURNS TRIGGER AS $$
DECLARE
    compatible_player RECORD;
    game_id UUID;
BEGIN
    -- Log that the trigger fired
    RAISE NOTICE '🎯 MATCHMAKING TRIGGER FIRED for user: % (rating: %)', NEW.user_id, NEW.rating;
    
    -- Broadcast that a player joined the queue
    PERFORM pg_notify(
        'matchmaking_events',
        json_build_object(
            'event', 'player_joined_queue',
            'user_id', NEW.user_id,
            'rating', NEW.rating,
            'timestamp', NOW()
        )::text
    );
    
    RAISE NOTICE '📡 Broadcasted: player_joined_queue for user: %', NEW.user_id;
    
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
        
        -- Broadcast that a match was found
        PERFORM pg_notify(
            'matchmaking_events',
            json_build_object(
                'event', 'match_found',
                'player1_id', NEW.user_id,
                'player1_rating', NEW.rating,
                'player2_id', compatible_player.user_id,
                'player2_rating', compatible_player.rating,
                'timestamp', NOW()
            )::text
        );
        
        RAISE NOTICE '📡 Broadcasted: match_found between % and %', NEW.user_id, compatible_player.user_id;
        
        -- Create the game
        BEGIN
            INSERT INTO games (player1_id, player2_id, status, created_at, updated_at)
            VALUES (NEW.user_id, compatible_player.user_id, 'waiting', NOW(), NOW())
            RETURNING id INTO game_id;
            
            RAISE NOTICE '🎮 Game created successfully: %', game_id;
            
            -- Broadcast that a game was created
            PERFORM pg_notify(
                'matchmaking_events',
                json_build_object(
                    'event', 'game_created',
                    'game_id', game_id,
                    'player1_id', NEW.user_id,
                    'player2_id', compatible_player.user_id,
                    'status', 'waiting',
                    'timestamp', NOW()
                )::text
            );
            
            RAISE NOTICE '📡 Broadcasted: game_created with ID: %', game_id;
            
            -- Remove both players from queue
            DELETE FROM game_queue 
            WHERE user_id IN (NEW.user_id, compatible_player.user_id);
            
            RAISE NOTICE '✅ Players removed from queue: % and %', NEW.user_id, compatible_player.user_id;
            
            -- Broadcast that players were removed from queue
            PERFORM pg_notify(
                'matchmaking_events',
                json_build_object(
                    'event', 'players_removed_from_queue',
                    'player1_id', NEW.user_id,
                    'player2_id', compatible_player.user_id,
                    'timestamp', NOW()
                )::text
            );
            
            RAISE NOTICE '📡 Broadcasted: players_removed_from_queue for % and %', NEW.user_id, compatible_player.user_id;
            
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE '❌ Failed to create game: %', SQLERRM;
                
                -- Broadcast the error
                PERFORM pg_notify(
                    'matchmaking_events',
                    json_build_object(
                        'event', 'matchmaking_error',
                        'error', SQLERRM,
                        'player1_id', NEW.user_id,
                        'player2_id', compatible_player.user_id,
                        'timestamp', NOW()
                    )::text
                );
        END;
    ELSE
        RAISE NOTICE '⏳ No compatible player found for % (rating: %), waiting...', NEW.user_id, NEW.rating;
        
        -- Broadcast that no match was found
        PERFORM pg_notify(
            'matchmaking_events',
            json_build_object(
                'event', 'no_match_found',
                'user_id', NEW.user_id,
                'rating', NEW.rating,
                'timestamp', NOW()
            )::text
        );
        
        RAISE NOTICE '📡 Broadcasted: no_match_found for user: %', NEW.user_id;
    END IF;
    
    -- Re-enable RLS
    SET LOCAL row_security = on;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_process_matchmaking ON game_queue;

-- Create the trigger
CREATE TRIGGER trigger_process_matchmaking
    AFTER INSERT ON game_queue
    FOR EACH ROW
    EXECUTE FUNCTION process_matchmaking();

-- Create a test function to manually trigger matchmaking
CREATE OR REPLACE FUNCTION test_matchmaking()
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
    
    result := '🧪 Testing matchmaking with users: ' || test_user1 || ' and ' || test_user2 || E'\n';
    
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