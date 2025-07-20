-- Simple test to check basic database state
-- Run this in Supabase SQL editor

-- 1. Check if users table exists and has data
SELECT 'Checking users table...' as info;
SELECT COUNT(*) as user_count FROM users;

-- 2. Check if game_queue table exists
SELECT 'Checking game_queue table...' as info;
SELECT COUNT(*) as queue_count FROM game_queue;

-- 3. Check if games table exists
SELECT 'Checking games table...' as info;
SELECT COUNT(*) as games_count FROM games;

-- 4. Check if functions exist
SELECT 'Checking if functions exist...' as info;
SELECT routine_name FROM information_schema.routines 
WHERE routine_name IN ('process_matchmaking', 'manual_process_matchmaking', 'test_full_matchmaking_flow');

-- 5. Try to call the test function directly
SELECT 'Testing function call...' as info;
SELECT test_full_matchmaking_flow(); 