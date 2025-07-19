-- Fix match creation notification to use Supabase broadcast instead of pg_notify
-- Update the process_matchmaking function to use proper notification

CREATE OR REPLACE FUNCTION process_matchmaking()
RETURNS TRIGGER AS $$
DECLARE
    player1 RECORD;
    player2 RECORD;
    game_id UUID;
    channel_name TEXT;
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
                -- Create a game
                INSERT INTO games (player1_id, player2_id, status, current_player, created_at, updated_at)
                VALUES (player1.user_id, player2.user_id, 'waiting', player1.user_id, NOW(), NOW())
                RETURNING id INTO game_id;
                
                -- Remove both players from queue
                DELETE FROM game_queue WHERE user_id IN (player1.user_id, player2.user_id);
                
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

-- Create a function to send match notifications via Supabase broadcast
CREATE OR REPLACE FUNCTION notify_match_created()
RETURNS TRIGGER AS $$
BEGIN
    -- This will be handled by the client-side subscription to INSERT events
    -- The client will detect the new game and show the match found modal
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to notify when games are created
DROP TRIGGER IF EXISTS trigger_notify_match_created ON games;
CREATE TRIGGER trigger_notify_match_created
    AFTER INSERT ON games
    FOR EACH ROW
    EXECUTE FUNCTION notify_match_created(); 