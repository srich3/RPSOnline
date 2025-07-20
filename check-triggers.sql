-- Check what triggers are installed on game_queue table
-- Run this in Supabase SQL editor

-- 1. Check all triggers on game_queue table
SELECT '=== TRIGGERS ON GAME_QUEUE ===' as info;
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement,
    action_orientation
FROM information_schema.triggers 
WHERE event_object_table = 'game_queue'
ORDER BY trigger_name;

-- 2. Check if the trigger functions exist
SELECT '=== TRIGGER FUNCTIONS ===' as info;
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_name IN (
    'process_matchmaking',
    'test_simple_trigger',
    'simple_test_trigger',
    'test_trigger_log'
);

-- 3. Check trigger function definitions
SELECT '=== TRIGGER FUNCTION DEFINITIONS ===' as info;
SELECT 
    proname as function_name,
    prosrc as function_source
FROM pg_proc 
WHERE proname IN (
    'process_matchmaking',
    'test_simple_trigger',
    'simple_test_trigger',
    'test_trigger_log'
);

-- 4. Test a simple insert to see if ANY trigger fires
SELECT '=== TESTING TRIGGER EXECUTION ===' as info;
SELECT 'Adding test player to queue...' as info;

-- Clear queue first
DELETE FROM game_queue;

-- Add a test player
INSERT INTO game_queue (user_id, rating) 
SELECT id, 100 FROM users LIMIT 1;

SELECT 'Test player added. Check logs for trigger messages.' as info; 