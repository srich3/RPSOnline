-- Test to verify the trigger is working
-- This will help us debug if the trigger is being called at all

-- Create a simple test function that just logs when called
CREATE OR REPLACE FUNCTION test_trigger_log()
RETURNS TRIGGER AS $$
BEGIN
    RAISE NOTICE '🔔 TEST TRIGGER CALLED for user: % with rating: %', NEW.user_id, NEW.rating;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a test trigger
DROP TRIGGER IF EXISTS test_trigger ON game_queue;
CREATE TRIGGER test_trigger
    AFTER INSERT ON game_queue
    FOR EACH ROW
    EXECUTE FUNCTION test_trigger_log();

-- Also add a BEFORE trigger to see if it gets called
CREATE OR REPLACE FUNCTION test_before_trigger_log()
RETURNS TRIGGER AS $$
BEGIN
    RAISE NOTICE '🔔 BEFORE TRIGGER CALLED for user: % with rating: %', NEW.user_id, NEW.rating;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a BEFORE trigger
DROP TRIGGER IF EXISTS test_before_trigger ON game_queue;
CREATE TRIGGER test_before_trigger
    BEFORE INSERT ON game_queue
    FOR EACH ROW
    EXECUTE FUNCTION test_before_trigger_log();

-- Create a function to test the entire flow
CREATE OR REPLACE FUNCTION test_full_matchmaking_flow()
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
    
    result := result || '🧪 Testing with users: ' || test_user1 || ' and ' || test_user2 || E'\n';
    
    -- Clear queue
    DELETE FROM game_queue;
    result := result || '🧹 Cleared queue' || E'\n';
    
    -- Add first player
    INSERT INTO game_queue (user_id, rating) VALUES (test_user1, 100);
    result := result || '✅ Added first player' || E'\n';
    
    -- Check queue
    SELECT result || '📋 Queue size after first player: ' || COUNT(*) INTO result FROM game_queue;
    
    -- Add second player
    INSERT INTO game_queue (user_id, rating) VALUES (test_user2, 150);
    result := result || E'\n✅ Added second player' || E'\n';
    
    -- Check queue again
    SELECT result || '📋 Queue size after second player: ' || COUNT(*) INTO result FROM game_queue;
    
    -- Check if any games were created
    SELECT result || E'\n🎮 Games created: ' || COUNT(*) INTO result FROM games WHERE status = 'waiting' AND created_at > NOW() - INTERVAL '1 minute';
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 