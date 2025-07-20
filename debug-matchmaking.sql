-- Comprehensive matchmaking debug script
-- Run this in the Supabase SQL editor to test the entire flow

-- 1. Check current state
SELECT '=== CURRENT STATE ===' as info;
SELECT 'Users:' as info;
SELECT id, username, rating FROM users LIMIT 3;

SELECT 'Queue:' as info;
SELECT * FROM game_queue;

SELECT 'Active games:' as info;
SELECT id, player1_id, player2_id, status, created_at FROM games WHERE status IN ('waiting', 'active');

-- 2. Test the full matchmaking flow
SELECT '=== TESTING FULL FLOW ===' as info;
SELECT test_full_matchmaking_flow();

-- 3. Check state after test
SELECT '=== STATE AFTER TEST ===' as info;
SELECT 'Queue after test:' as info;
SELECT * FROM game_queue;

SELECT 'Games after test:' as info;
SELECT id, player1_id, player2_id, status, created_at FROM games WHERE status IN ('waiting', 'active') ORDER BY created_at DESC;

-- 4. Test manual matchmaking
SELECT '=== MANUAL MATCHMAKING ===' as info;
SELECT manual_process_matchmaking();

-- 5. Final state
SELECT '=== FINAL STATE ===' as info;
SELECT 'Final queue:' as info;
SELECT * FROM game_queue;

SELECT 'Final games:' as info;
SELECT id, player1_id, player2_id, status, created_at FROM games WHERE status IN ('waiting', 'active') ORDER BY created_at DESC;

-- 6. Check trigger status
SELECT '=== TRIGGER STATUS ===' as info;
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'game_queue';

-- 7. Check function status
SELECT '=== FUNCTION STATUS ===' as info;
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_name IN ('process_matchmaking', 'manual_process_matchmaking', 'test_trigger_log'); 