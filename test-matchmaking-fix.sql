-- Test script to verify matchmaking fix
-- This script tests that games are created with 'waiting' status instead of 'active'

-- Clear any existing test data
DELETE FROM game_queue;
DELETE FROM games WHERE created_at > NOW() - INTERVAL '5 minutes';
DELETE FROM matchmaking_broadcasts WHERE created_at > NOW() - INTERVAL '5 minutes';

-- Get two test users
DO $$
DECLARE
    user1_id UUID;
    user2_id UUID;
    game_id UUID;
BEGIN
    -- Get two different users for testing
    SELECT id INTO user1_id FROM users LIMIT 1;
    SELECT id INTO user2_id FROM users WHERE id != user1_id LIMIT 1;
    
    IF user1_id IS NULL OR user2_id IS NULL THEN
        RAISE NOTICE '❌ Need at least 2 users for testing';
        RETURN;
    END IF;
    
    RAISE NOTICE '🧪 Testing matchmaking with users: % and %', user1_id, user2_id;
    
    -- Add first player to queue
    INSERT INTO game_queue (user_id, rating) VALUES (user1_id, 100);
    RAISE NOTICE '✅ Added first player to queue';
    
    -- Check queue
    RAISE NOTICE '📋 Queue size after first player: %', (SELECT COUNT(*) FROM game_queue);
    
    -- Add second player to queue (should trigger matchmaking)
    INSERT INTO game_queue (user_id, rating) VALUES (user2_id, 150);
    RAISE NOTICE '✅ Added second player to queue';
    
    -- Check queue again
    RAISE NOTICE '📋 Queue size after second player: %', (SELECT COUNT(*) FROM game_queue);
    
    -- Check if a game was created
    SELECT id INTO game_id FROM games 
    WHERE (player1_id = user1_id AND player2_id = user2_id) 
       OR (player1_id = user2_id AND player2_id = user1_id)
    AND created_at > NOW() - INTERVAL '1 minute';
    
    IF game_id IS NOT NULL THEN
        RAISE NOTICE '🎮 Game created with ID: %', game_id;
        
        -- Check the game status
        RAISE NOTICE '📊 Game status: %', (SELECT status FROM games WHERE id = game_id);
        
        -- Verify it's 'waiting' status
        IF (SELECT status FROM games WHERE id = game_id) = 'waiting' THEN
            RAISE NOTICE '✅ SUCCESS: Game created with waiting status!';
        ELSE
            RAISE NOTICE '❌ FAILURE: Game created with wrong status!';
        END IF;
    ELSE
        RAISE NOTICE '❌ No game was created';
    END IF;
    
    -- Check broadcasts
    RAISE NOTICE '📡 Broadcasts sent: %', (SELECT COUNT(*) FROM matchmaking_broadcasts WHERE created_at > NOW() - INTERVAL '1 minute');
    
END $$; 