-- Test trigger execution and add more debugging
-- This will help us verify if the trigger is actually working

-- First, let's check if the trigger exists and recreate it with more debugging
DROP TRIGGER IF EXISTS trigger_process_matchmaking ON game_queue;

-- Create a simple test function first
CREATE OR REPLACE FUNCTION test_trigger_simple()
RETURNS TRIGGER AS $$
BEGIN
    RAISE NOTICE '🎯 SIMPLE TRIGGER FIRED for user: %', NEW.user_id;
    RAISE NOTICE '🎯 NEW record: %', NEW;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a simple trigger to test
CREATE TRIGGER trigger_test_simple
    AFTER INSERT ON game_queue
    FOR EACH ROW
    EXECUTE FUNCTION test_trigger_simple();

-- Now recreate the main matchmaking function with more debugging
DROP FUNCTION IF EXISTS process_matchmaking();

CREATE OR REPLACE FUNCTION process_matchmaking()
RETURNS TRIGGER AS $$
DECLARE
    compatible_player RECORD;
    game_id UUID;
    queue_count INTEGER;
BEGIN
    -- Log that the trigger fired with more details
    RAISE NOTICE '🎯 MATCHMAKING TRIGGER FIRED for user: % (rating: %)', NEW.user_id, NEW.rating;
    RAISE NOTICE '🎯 NEW record: %', NEW;
    
    -- Check how many players are in the queue
    SELECT COUNT(*) INTO queue_count FROM game_queue;
    RAISE NOTICE '📋 Total players in queue: %', queue_count;
    
    -- Broadcast that a player joined the queue
    INSERT INTO matchmaking_broadcasts (event_type, event_data)
    VALUES (
        'player_joined_queue',
        jsonb_build_object(
            'user_id', NEW.user_id,
            'rating', NEW.rating,
            'timestamp', NOW()
        )
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
    
    RAISE NOTICE '🔍 Looking for compatible player...';
    RAISE NOTICE '🔍 Compatible player found: %', compatible_player.user_id;
    
    -- If we found a compatible player, create a game
    IF compatible_player.user_id IS NOT NULL THEN
        RAISE NOTICE '🎯 Found compatible player: % (rating: %) vs % (rating: %)', 
            NEW.user_id, NEW.rating, compatible_player.user_id, compatible_player.rating;
        
        -- Broadcast that a match was found
        INSERT INTO matchmaking_broadcasts (event_type, event_data)
        VALUES (
            'match_found',
            jsonb_build_object(
                'player1_id', NEW.user_id,
                'player1_rating', NEW.rating,
                'player2_id', compatible_player.user_id,
                'player2_rating', compatible_player.rating,
                'timestamp', NOW()
            )
        );
        
        RAISE NOTICE '📡 Broadcasted: match_found between % and %', NEW.user_id, compatible_player.user_id;
        
        -- Create the game
        BEGIN
            INSERT INTO games (player1_id, player2_id, status, created_at, updated_at)
            VALUES (NEW.user_id, compatible_player.user_id, 'waiting', NOW(), NOW())
            RETURNING id INTO game_id;
            
            RAISE NOTICE '🎮 Game created successfully: %', game_id;
            
            -- Broadcast that a game was created
            INSERT INTO matchmaking_broadcasts (event_type, event_data)
            VALUES (
                'game_created',
                jsonb_build_object(
                    'game_id', game_id,
                    'player1_id', NEW.user_id,
                    'player2_id', compatible_player.user_id,
                    'status', 'waiting',
                    'timestamp', NOW()
                )
            );
            
            RAISE NOTICE '📡 Broadcasted: game_created with ID: %', game_id;
            
            -- Remove both players from queue
            DELETE FROM game_queue 
            WHERE user_id IN (NEW.user_id, compatible_player.user_id);
            
            RAISE NOTICE '✅ Players removed from queue: % and %', NEW.user_id, compatible_player.user_id;
            
            -- Broadcast that players were removed from queue
            INSERT INTO matchmaking_broadcasts (event_type, event_data)
            VALUES (
                'players_removed_from_queue',
                jsonb_build_object(
                    'player1_id', NEW.user_id,
                    'player2_id', compatible_player.user_id,
                    'timestamp', NOW()
                )
            );
            
            RAISE NOTICE '📡 Broadcasted: players_removed_from_queue for % and %', NEW.user_id, compatible_player.user_id;
            
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE '❌ Failed to create game: %', SQLERRM;
                
                -- Broadcast the error
                INSERT INTO matchmaking_broadcasts (event_type, event_data)
                VALUES (
                    'matchmaking_error',
                    jsonb_build_object(
                        'error', SQLERRM,
                        'player1_id', NEW.user_id,
                        'player2_id', compatible_player.user_id,
                        'timestamp', NOW()
                    )
                );
        END;
    ELSE
        RAISE NOTICE '⏳ No compatible player found for % (rating: %), waiting...', NEW.user_id, NEW.rating;
        
        -- Broadcast that no match was found
        INSERT INTO matchmaking_broadcasts (event_type, event_data)
        VALUES (
            'no_match_found',
            jsonb_build_object(
                'user_id', NEW.user_id,
                'rating', NEW.rating,
                'timestamp', NOW()
            )
        );
        
        RAISE NOTICE '📡 Broadcasted: no_match_found for user: %', NEW.user_id;
    END IF;
    
    -- Re-enable RLS
    SET LOCAL row_security = on;
    
    RAISE NOTICE '🎯 MATCHMAKING TRIGGER COMPLETED for user: %', NEW.user_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the main trigger
CREATE TRIGGER trigger_process_matchmaking
    AFTER INSERT ON game_queue
    FOR EACH ROW
    EXECUTE FUNCTION process_matchmaking();

-- Create a function to manually test the trigger
CREATE OR REPLACE FUNCTION test_trigger_manually()
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
    
    result := '🧪 Testing trigger manually with users: ' || test_user1 || ' and ' || test_user2 || E'\n';
    
    -- Clear queue and broadcasts
    DELETE FROM game_queue;
    DELETE FROM matchmaking_broadcasts;
    result := result || '🧹 Cleared queue and broadcasts' || E'\n';
    
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
    
    -- Check broadcasts
    SELECT result || E'\n📡 Broadcasts sent: ' || COUNT(*) INTO result FROM matchmaking_broadcasts WHERE created_at > NOW() - INTERVAL '1 minute';
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 