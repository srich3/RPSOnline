-- Fix the process_matchmaking function to filter out completed/canceled games
-- The current function doesn't exclude completed games, preventing players from joining queue after a game is canceled

-- Drop the existing trigger
DROP TRIGGER IF EXISTS trigger_process_matchmaking ON game_queue;
DROP FUNCTION IF EXISTS process_matchmaking;

-- Create the corrected process_matchmaking function
CREATE OR REPLACE FUNCTION process_matchmaking()
RETURNS TRIGGER AS $$
DECLARE
    player1 RECORD;
    player2 RECORD;
    game_id UUID;
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
                -- Check if either player is already in an active game (excluding completed/canceled games)
                IF NOT EXISTS (
                    SELECT 1 FROM games 
                    WHERE (player1_id IN (player1.user_id, player2.user_id) 
                           OR player2_id IN (player1.user_id, player2.user_id))
                    AND status IN ('waiting', 'active')
                    AND completion_type IS NULL -- Only include games that haven't been completed/canceled
                ) THEN
                    -- Create a game
                    BEGIN
                        INSERT INTO games (player1_id, player2_id, status, created_at, updated_at)
                        VALUES (player1.user_id, player2.user_id, 'waiting', NOW(), NOW())
                        RETURNING id INTO game_id;
                        
                        -- Remove both players from queue
                        DELETE FROM game_queue WHERE user_id IN (player1.user_id, player2.user_id);
                        
                        -- Log the match creation
                        RAISE NOTICE 'Match created: % vs % (Game ID: %)', player1.username, player2.username, game_id;
                        
                        -- Exit the loops since we found a match
                        RETURN NEW;
                    EXCEPTION
                        WHEN OTHERS THEN
                            -- If game creation fails (e.g., player already in game), continue looking
                            RAISE NOTICE 'Failed to create game for % vs %: %', player1.username, player2.username, SQLERRM;
                            CONTINUE;
                    END;
                ELSE
                    -- One or both players are already in an active game, remove them from queue
                    DELETE FROM game_queue WHERE user_id IN (player1.user_id, player2.user_id);
                    RAISE NOTICE 'Removed players from queue - already in active game: % and %', player1.username, player2.username;
                END IF;
            END IF;
        END LOOP;
    END LOOP;
    
    -- Re-enable RLS
    SET LOCAL row_security = on;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER trigger_process_matchmaking
    AFTER INSERT ON game_queue
    FOR EACH ROW
    EXECUTE FUNCTION process_matchmaking();

-- Also fix the cleanup function to filter out completed games
DROP FUNCTION IF EXISTS cleanup_queue_for_active_players;
CREATE OR REPLACE FUNCTION cleanup_queue_for_active_players()
RETURNS INTEGER AS $$
DECLARE
    removed_count INTEGER := 0;
BEGIN
    -- Remove queue entries for players who are already in active games (excluding completed/canceled games)
    DELETE FROM game_queue 
    WHERE user_id IN (
        SELECT DISTINCT player1_id FROM games 
        WHERE status IN ('waiting', 'active') 
        AND completion_type IS NULL
        UNION
        SELECT DISTINCT player2_id FROM games 
        WHERE status IN ('waiting', 'active') 
        AND completion_type IS NULL
    );
    
    GET DIAGNOSTICS removed_count = ROW_COUNT;
    
    IF removed_count > 0 THEN
        RAISE NOTICE 'Removed % queue entries for players already in active games', removed_count;
    END IF;
    
    RETURN removed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 