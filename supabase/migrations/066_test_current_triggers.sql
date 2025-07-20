-- Test current triggers and identify any that might cause realtime.broadcast_changes errors
-- This will help us understand what's still running

-- Create a function to test all current triggers
CREATE OR REPLACE FUNCTION test_all_triggers()
RETURNS TEXT AS $$
DECLARE
    trigger_record RECORD;
    result TEXT := '🔍 Current triggers in the system:' || E'\n';
BEGIN
    -- List all triggers
    FOR trigger_record IN
        SELECT 
            t.trigger_name,
            t.event_object_table,
            t.event_manipulation,
            p.proname as function_name
        FROM information_schema.triggers t
        JOIN pg_proc p ON p.oid = t.action_statement::regproc
        WHERE t.trigger_schema = 'public'
        ORDER BY t.trigger_name
    LOOP
        result := result || '📋 ' || trigger_record.trigger_name || 
                  ' on ' || trigger_record.event_object_table || 
                  ' (' || trigger_record.event_manipulation || ')' ||
                  ' -> ' || trigger_record.function_name || E'\n';
    END LOOP;
    
    -- Test if any functions contain realtime.broadcast_changes
    result := result || E'\n🔍 Checking for realtime.broadcast_changes in functions:' || E'\n';
    
    FOR trigger_record IN
        SELECT 
            p.proname as function_name,
            pg_get_functiondef(p.oid) as function_definition
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND pg_get_functiondef(p.oid) LIKE '%realtime.broadcast_changes%'
    LOOP
        result := result || '⚠️  Function ' || trigger_record.function_name || 
                  ' contains realtime.broadcast_changes' || E'\n';
    END LOOP;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a simple test to see if the matchmaking is working
CREATE OR REPLACE FUNCTION test_matchmaking_flow()
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
    
    result := '🧪 Testing complete matchmaking flow with users: ' || test_user1 || ' and ' || test_user2 || E'\n';
    
    -- Clear everything
    DELETE FROM game_queue;
    DELETE FROM matchmaking_broadcasts;
    DELETE FROM games WHERE status = 'active' AND created_at > NOW() - INTERVAL '5 minutes';
    result := result || '🧹 Cleared queue, broadcasts, and recent games' || E'\n';
    
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
    SELECT result || E'\n🎮 Games created: ' || COUNT(*) INTO result FROM games WHERE status = 'active' AND created_at > NOW() - INTERVAL '1 minute';
    
    -- Check broadcasts
    SELECT result || E'\n📡 Broadcasts sent: ' || COUNT(*) INTO result FROM matchmaking_broadcasts WHERE created_at > NOW() - INTERVAL '1 minute';
    
    -- Check for any errors in broadcasts
    SELECT result || E'\n❌ Error broadcasts: ' || COUNT(*) INTO result FROM matchmaking_broadcasts WHERE event_type = 'matchmaking_error' AND created_at > NOW() - INTERVAL '1 minute';
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 