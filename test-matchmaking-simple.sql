-- Simple test to debug matchmaking
-- Run this in Supabase SQL editor

-- 1. Check if we have any users
SELECT 'Users in database:' as info;
SELECT id, username, rating FROM users LIMIT 5;

-- 2. Clear the queue for testing
SELECT 'Clearing queue...' as info;
SELECT clear_queue_for_testing();

-- 3. Check current queue
SELECT 'Queue after clearing:' as info;
SELECT * FROM game_queue;

-- 4. Check current games
SELECT 'Current games:' as info;
SELECT id, player1_id, player2_id, status FROM games WHERE status IN ('waiting', 'active');

-- 5. Test adding a player to queue (replace with actual user ID)
-- First, let's get a user ID to test with
SELECT 'Testing with first user:' as info;
SELECT test_add_player_to_queue((SELECT id FROM users LIMIT 1), 100);

-- 6. Check queue after adding player
SELECT 'Queue after adding player:' as info;
SELECT * FROM game_queue;

-- 7. Test adding another player with compatible rating
SELECT 'Adding second player:' as info;
SELECT test_add_player_to_queue((SELECT id FROM users WHERE id != (SELECT user_id FROM game_queue LIMIT 1) LIMIT 1), 150);

-- 8. Check queue after adding second player
SELECT 'Queue after adding second player:' as info;
SELECT * FROM game_queue;

-- 9. Check if any games were created
SELECT 'Games after adding players:' as info;
SELECT id, player1_id, player2_id, status, created_at FROM games WHERE status IN ('waiting', 'active') ORDER BY created_at DESC;

-- 10. Test manual matchmaking
SELECT 'Running manual matchmaking:' as info;
SELECT manual_process_matchmaking();

-- 11. Final check
SELECT 'Final queue state:' as info;
SELECT * FROM game_queue;

SELECT 'Final games state:' as info;
SELECT id, player1_id, player2_id, status, created_at FROM games WHERE status IN ('waiting', 'active') ORDER BY created_at DESC; 