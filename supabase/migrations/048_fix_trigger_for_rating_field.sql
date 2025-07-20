-- Fix trigger that stopped working after adding rating field to game_queue
-- The trigger might be expecting the old table structure

-- First, let's check what triggers exist and drop them
DROP TRIGGER IF EXISTS trigger_process_matchmaking ON game_queue;
DROP TRIGGER IF EXISTS test_simple_trigger ON game_queue;
DROP TRIGGER IF EXISTS simple_test_trigger ON game_queue;

-- Drop the functions
DROP FUNCTION IF EXISTS process_matchmaking();
DROP FUNCTION IF EXISTS test_simple_trigger();
DROP FUNCTION IF EXISTS simple_test_trigger();

-- Create a simple test trigger first to verify triggers work
CREATE OR REPLACE FUNCTION test_trigger_works()
RETURNS TRIGGER AS $$
BEGIN
    RAISE NOTICE '🔔 TRIGGER WORKING! User: %, Rating: %', NEW.user_id, NEW.rating;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the test trigger
CREATE TRIGGER test_trigger_works
    AFTER INSERT ON game_queue
    FOR EACH ROW
    EXECUTE FUNCTION test_trigger_works();

-- Now create the efficient matchmaking function that works with the rating field
CREATE OR REPLACE FUNCTION process_matchmaking()
RETURNS TRIGGER AS $$
DECLARE
    compatible_player RECORD;
    game_id UUID;
BEGIN
    RAISE NOTICE '🎯 Matchmaking triggered for user: % (rating: %)', NEW.user_id, NEW.rating;
    
    -- Temporarily disable RLS for this function
    SET LOCAL row_security = off;
    
    -- Find a compatible player with simple SELECT query
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

-- Create the matchmaking trigger
CREATE TRIGGER trigger_process_matchmaking
    AFTER INSERT ON game_queue
    FOR EACH ROW
    EXECUTE FUNCTION process_matchmaking();

-- Create a function to test if triggers are working
CREATE OR REPLACE FUNCTION test_trigger_functionality()
RETURNS TEXT AS $$
DECLARE
    test_user UUID;
    result TEXT := '';
BEGIN
    -- Get a test user
    SELECT id INTO test_user FROM users LIMIT 1;
    
    IF test_user IS NULL THEN
        RETURN '❌ No users found for testing';
    END IF;
    
    result := '🧪 Testing trigger functionality with user: ' || test_user || E'\n';
    
    -- Clear queue
    DELETE FROM game_queue;
    result := result || '🧹 Cleared queue' || E'\n';
    
    -- Add a player and see if trigger fires
    INSERT INTO game_queue (user_id, rating) VALUES (test_user, 100);
    result := result || '✅ Added player to queue' || E'\n';
    
    -- Check if player is still in queue (trigger should have processed)
    SELECT result || '📋 Queue size after trigger: ' || COUNT(*) INTO result FROM game_queue;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 