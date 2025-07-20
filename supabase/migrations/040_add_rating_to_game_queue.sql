-- Add rating column to game_queue table for better skill-based matchmaking
-- This will allow the matchmaking system to match players with similar skill levels more efficiently

-- Add rating column to game_queue table
ALTER TABLE public.game_queue 
ADD COLUMN IF NOT EXISTS rating INTEGER NOT NULL DEFAULT 100;

-- Create index on rating for efficient matchmaking queries
CREATE INDEX IF NOT EXISTS idx_game_queue_rating ON public.game_queue(rating);

-- Create composite index for rating + created_at for efficient matchmaking
CREATE INDEX IF NOT EXISTS idx_game_queue_rating_created_at ON public.game_queue(rating, created_at ASC);

-- Update the process_matchmaking function to use the rating from the queue
-- This eliminates the need to JOIN with users table for every matchmaking check
DROP TRIGGER IF EXISTS trigger_process_matchmaking ON game_queue;
DROP FUNCTION IF EXISTS process_matchmaking;

CREATE OR REPLACE FUNCTION process_matchmaking()
RETURNS TRIGGER AS $$
DECLARE
    player1 RECORD;
    player2 RECORD;
    game_id UUID;
BEGIN
    -- Temporarily disable RLS for this function to access all queue entries
    SET LOCAL row_security = off;
    
    -- Get all players in queue with their ratings
    -- Now we can use the rating directly from the queue without JOINing users table
    FOR player1 IN 
        SELECT 
            q.user_id,
            q.created_at,
            q.rating
        FROM game_queue q
        ORDER BY q.created_at ASC
    LOOP
        -- Look for a suitable opponent within rating range
        FOR player2 IN 
            SELECT 
                q.user_id,
                q.created_at,
                q.rating
            FROM game_queue q
            WHERE q.user_id != player1.user_id
            AND ABS(q.rating - player1.rating) <= 300  -- Within 300 rating points
            ORDER BY q.created_at ASC
        LOOP
            -- Check if either player is already in an active game
            IF NOT EXISTS (
                SELECT 1 FROM games 
                WHERE (player1_id IN (player1.user_id, player2.user_id) 
                       OR player2_id IN (player1.user_id, player2.user_id))
                AND status IN ('waiting', 'active')
            ) THEN
                -- Create a game
                BEGIN
                    INSERT INTO games (player1_id, player2_id, status, created_at, updated_at)
                    VALUES (player1.user_id, player2.user_id, 'waiting', NOW(), NOW())
                    RETURNING id INTO game_id;
                    
                    -- Remove both players from queue
                    DELETE FROM game_queue WHERE user_id IN (player1.user_id, player2.user_id);
                    
                    -- Log the match creation with ratings
                    RAISE NOTICE 'Match created: Player % (rating: %) vs Player % (rating: %) (Game ID: %)', 
                        player1.user_id, player1.rating, player2.user_id, player2.rating, game_id;
                    
                    -- Exit the loops since we found a match
                    RETURN NEW;
                EXCEPTION
                    WHEN OTHERS THEN
                        -- If game creation fails (e.g., player already in game), continue looking
                        RAISE NOTICE 'Failed to create game for % vs %: %', player1.user_id, player2.user_id, SQLERRM;
                        CONTINUE;
                END;
            ELSE
                -- One or both players are already in an active game, remove them from queue
                DELETE FROM game_queue WHERE user_id IN (player1.user_id, player2.user_id);
                RAISE NOTICE 'Removed players from queue - already in active game: % and %', player1.user_id, player2.user_id;
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

-- Update the cleanup function to also consider rating
DROP FUNCTION IF EXISTS cleanup_queue_for_active_players;
CREATE OR REPLACE FUNCTION cleanup_queue_for_active_players()
RETURNS INTEGER AS $$
DECLARE
    removed_count INTEGER := 0;
BEGIN
    -- Remove queue entries for players who are already in active games
    DELETE FROM game_queue 
    WHERE user_id IN (
        SELECT DISTINCT player1_id FROM games 
        WHERE status IN ('waiting', 'active')
        UNION
        SELECT DISTINCT player2_id FROM games 
        WHERE status IN ('waiting', 'active')
    );
    
    GET DIAGNOSTICS removed_count = ROW_COUNT;
    
    IF removed_count > 0 THEN
        RAISE NOTICE 'Removed % queue entries for players already in active games', removed_count;
    END IF;
    
    RETURN removed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to update queue entries with current user ratings
-- This ensures queue ratings stay up-to-date with user rating changes
CREATE OR REPLACE FUNCTION update_queue_ratings()
RETURNS TRIGGER AS $$
BEGIN
    -- When a user's rating changes, update their queue entry if they have one
    IF TG_OP = 'UPDATE' AND OLD.rating != NEW.rating THEN
        UPDATE game_queue 
        SET rating = NEW.rating 
        WHERE user_id = NEW.id;
        
        IF FOUND THEN
            RAISE NOTICE 'Updated queue rating for user % from % to %', NEW.id, OLD.rating, NEW.rating;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to keep queue ratings in sync with user ratings
CREATE TRIGGER trigger_update_queue_ratings
    AFTER UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_queue_ratings(); 