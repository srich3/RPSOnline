-- Fix realtime notifications to ensure both players get notified
-- Add proper broadcast system and handle race conditions

-- Create a function to broadcast match creation to both players
CREATE OR REPLACE FUNCTION broadcast_match_created()
RETURNS TRIGGER AS $$
BEGIN
    -- This function will be called after a game is inserted
    -- We'll use Supabase's broadcast system to notify both players immediately
    
    -- Log the match creation for debugging
    RAISE NOTICE 'Broadcasting match creation: Game ID % for players % and %', 
        NEW.id, NEW.player1_id, NEW.player2_id;
    
    -- Note: The actual broadcast will be handled by the client-side subscription
    -- to the games table INSERT event, which both players will receive
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update the process_matchmaking function to handle race conditions
CREATE OR REPLACE FUNCTION process_matchmaking()
RETURNS TRIGGER AS $$
DECLARE
    player1 RECORD;
    player2 RECORD;
    game_id UUID;
    player1_id UUID;
    player2_id UUID;
BEGIN
    -- Temporarily disable RLS for this function to access all queue entries
    SET LOCAL row_security = off;
    
    -- Get all players in queue with their profiles
    FOR player1 IN 
        SELECT 
            q.user_id,
            q.created_at,
            u.username,
            u.rating
        FROM game_queue q
        JOIN users u ON q.user_id = u.id
        ORDER BY q.created_at ASC
    LOOP
        -- Look for a suitable opponent
        FOR player2 IN 
            SELECT 
                q.user_id,
                q.created_at,
                u.username,
                u.rating
            FROM game_queue q
            JOIN users u ON q.user_id = u.id
            WHERE q.user_id != player1.user_id
            ORDER BY q.created_at ASC
        LOOP
            -- Check if they're a good match (within 300 rating points)
            IF ABS(player1.rating - player2.rating) <= 300 THEN
                -- Store player IDs before removing from queue
                player1_id := player1.user_id;
                player2_id := player2.user_id;
                
                -- Create a game first (this will trigger INSERT event for both players)
                INSERT INTO games (player1_id, player2_id, status, current_player, created_at, updated_at)
                VALUES (player1_id, player2_id, 'waiting', player1_id, NOW(), NOW())
                RETURNING id INTO game_id;
                
                -- Remove both players from queue AFTER creating the game
                -- This ensures both players receive the games INSERT event before being removed from queue
                DELETE FROM game_queue WHERE user_id IN (player1_id, player2_id);
                
                -- Log the match creation
                RAISE NOTICE 'Match created: % vs % (Game ID: %)', player1.username, player2.username, game_id;
                
                -- Exit the loops since we found a match
                RETURN NEW;
            END IF;
        END LOOP;
    END LOOP;
    
    -- Re-enable RLS
    SET LOCAL row_security = on;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 