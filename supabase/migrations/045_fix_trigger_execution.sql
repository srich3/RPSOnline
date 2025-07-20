-- Fix trigger execution issue
-- The trigger is not being called when players are added to queue

-- First, let's check if the trigger exists and recreate it with proper permissions
DROP TRIGGER IF EXISTS trigger_process_matchmaking ON game_queue;
DROP TRIGGER IF EXISTS test_trigger ON game_queue;
DROP TRIGGER IF EXISTS test_before_trigger ON game_queue;

-- Create a simple test trigger first to verify triggers work at all
CREATE OR REPLACE FUNCTION simple_test_trigger()
RETURNS TRIGGER AS $$
BEGIN
    RAISE NOTICE '🔔 SIMPLE TRIGGER WORKING for user: %', NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the simple test trigger
CREATE TRIGGER simple_test_trigger
    AFTER INSERT ON game_queue
    FOR EACH ROW
    EXECUTE FUNCTION simple_test_trigger();

-- Now recreate the main matchmaking trigger with better error handling
CREATE OR REPLACE FUNCTION process_matchmaking()
RETURNS TRIGGER AS $$
DECLARE
    player1 RECORD;
    player2 RECORD;
    game_id UUID;
    match_found BOOLEAN := FALSE;
    queue_count INTEGER;
BEGIN
    RAISE NOTICE '🎯 PROCESS_MATCHMAKING TRIGGER CALLED for user: %', NEW.user_id;
    
    -- Get queue count for debugging
    SELECT COUNT(*) INTO queue_count FROM game_queue;
    RAISE NOTICE '📊 Current queue size: %', queue_count;
    
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

-- Create the main matchmaking trigger
CREATE TRIGGER trigger_process_matchmaking
    AFTER INSERT ON game_queue
    FOR EACH ROW
    EXECUTE FUNCTION process_matchmaking();

-- Also create a function to manually test trigger execution
CREATE OR REPLACE FUNCTION test_trigger_execution()
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
    
    result := '🧪 Testing trigger execution with user: ' || test_user || E'\n';
    
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