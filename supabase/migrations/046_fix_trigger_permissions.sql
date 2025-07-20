-- Fix trigger permissions and execution
-- The trigger is not firing due to RLS or permission issues

-- First, let's check and fix the RLS policies on game_queue
-- Drop existing policies and recreate them to ensure they work with triggers
DROP POLICY IF EXISTS "Users can view own queue entries" ON public.game_queue;
DROP POLICY IF EXISTS "Matchmaking can view all queue entries" ON public.game_queue;
DROP POLICY IF EXISTS "Users can insert own queue entries" ON public.game_queue;
DROP POLICY IF EXISTS "Users can delete own queue entries" ON public.game_queue;

-- Recreate policies with better permissions for triggers
CREATE POLICY "Users can view own queue entries" ON public.game_queue
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Matchmaking can view all queue entries" ON public.game_queue
    FOR SELECT USING (true);

CREATE POLICY "Users can insert own queue entries" ON public.game_queue
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own queue entries" ON public.game_queue
    FOR DELETE USING (auth.uid() = user_id);

-- Add a policy for service role to manage queue entries
CREATE POLICY "Service role can manage queue entries" ON public.game_queue
    FOR ALL USING (auth.role() = 'service_role');

-- Drop all existing triggers and recreate them
DROP TRIGGER IF EXISTS trigger_process_matchmaking ON game_queue;
DROP TRIGGER IF EXISTS simple_test_trigger ON game_queue;
DROP TRIGGER IF EXISTS test_trigger ON game_queue;
DROP TRIGGER IF EXISTS test_before_trigger ON game_queue;

-- Create a very simple test trigger first
CREATE OR REPLACE FUNCTION test_simple_trigger()
RETURNS TRIGGER AS $$
BEGIN
    RAISE NOTICE '🔔 SIMPLE TRIGGER FIRED for user: % with rating: %', NEW.user_id, NEW.rating;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the simple test trigger
CREATE TRIGGER test_simple_trigger
    AFTER INSERT ON game_queue
    FOR EACH ROW
    EXECUTE FUNCTION test_simple_trigger();

-- Now create the main matchmaking trigger with explicit permissions
CREATE OR REPLACE FUNCTION process_matchmaking()
RETURNS TRIGGER AS $$
DECLARE
    player1 RECORD;
    player2 RECORD;
    game_id UUID;
    match_found BOOLEAN := FALSE;
    queue_count INTEGER;
BEGIN
    RAISE NOTICE '🎯 PROCESS_MATCHMAKING TRIGGER FIRED for user: %', NEW.user_id;
    
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

-- Create a function to test trigger execution with better debugging
CREATE OR REPLACE FUNCTION test_trigger_with_debug()
RETURNS TEXT AS $$
DECLARE
    test_user UUID;
    result TEXT := '';
    trigger_fired BOOLEAN := FALSE;
BEGIN
    -- Get a test user
    SELECT id INTO test_user FROM users LIMIT 1;
    
    IF test_user IS NULL THEN
        RETURN '❌ No users found for testing';
    END IF;
    
    result := '🧪 Testing trigger with user: ' || test_user || E'\n';
    
    -- Clear queue
    DELETE FROM game_queue;
    result := result || '🧹 Cleared queue' || E'\n';
    
    -- Add a player and see if trigger fires
    INSERT INTO game_queue (user_id, rating) VALUES (test_user, 100);
    result := result || '✅ Added player to queue' || E'\n';
    
    -- Check if player is still in queue (trigger should have processed)
    SELECT result || '📋 Queue size after trigger: ' || COUNT(*) INTO result FROM game_queue;
    
    -- Check if any games were created
    SELECT result || E'\n🎮 Games created: ' || COUNT(*) INTO result FROM games WHERE status = 'waiting' AND created_at > NOW() - INTERVAL '1 minute';
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 