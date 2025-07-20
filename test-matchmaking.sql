-- Test script to debug matchmaking
-- Run this in the Supabase SQL editor

-- 1. Check current queue
SELECT 'Current queue:' as info;
SELECT * FROM game_queue ORDER BY created_at ASC;

-- 2. Check current active games
SELECT 'Current active games:' as info;
SELECT id, player1_id, player2_id, status, created_at 
FROM games 
WHERE status IN ('waiting', 'active')
ORDER BY created_at DESC;

-- 3. Test manual matchmaking function
SELECT 'Running manual matchmaking...' as info;
SELECT manual_process_matchmaking();

-- 4. Check queue after manual matchmaking
SELECT 'Queue after manual matchmaking:' as info;
SELECT * FROM game_queue ORDER BY created_at ASC;

-- 5. Check games after manual matchmaking
SELECT 'Games after manual matchmaking:' as info;
SELECT id, player1_id, player2_id, status, created_at 
FROM games 
WHERE status IN ('waiting', 'active')
ORDER BY created_at DESC;

-- 6. Check if trigger exists
SELECT 'Checking trigger:' as info;
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_process_matchmaking';

-- 7. Check if function exists
SELECT 'Checking function:' as info;
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_name = 'process_matchmaking'; 