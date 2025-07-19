-- Add game integrity constraints to prevent players from being in multiple games
-- This ensures players can only be in one game at a time

-- First, let's clean up any existing duplicate entries (players in multiple games)
-- This is a one-time cleanup to ensure data integrity before adding constraints
DELETE FROM games 
WHERE id NOT IN (
    SELECT DISTINCT ON (player1_id) id 
    FROM games 
    WHERE player1_id IS NOT NULL 
    ORDER BY player1_id, created_at DESC
)
AND player1_id IN (
    SELECT player1_id 
    FROM games 
    GROUP BY player1_id 
    HAVING COUNT(*) > 1
);

DELETE FROM games 
WHERE id NOT IN (
    SELECT DISTINCT ON (player2_id) id 
    FROM games 
    WHERE player2_id IS NOT NULL 
    ORDER BY player2_id, created_at DESC
)
AND player2_id IN (
    SELECT player2_id 
    FROM games 
    GROUP BY player2_id 
    HAVING COUNT(*) > 1
);

-- Add unique constraints to prevent players from being in multiple active games
-- This creates a unique index that prevents the same player from being in multiple games
CREATE UNIQUE INDEX IF NOT EXISTS idx_games_player1_active 
ON games (player1_id) 
WHERE status IN ('waiting', 'active');

CREATE UNIQUE INDEX IF NOT EXISTS idx_games_player2_active 
ON games (player2_id) 
WHERE status IN ('waiting', 'active');

-- Add a check constraint to ensure a player can't be both player1 and player2 in the same game
ALTER TABLE games 
ADD CONSTRAINT check_player1_not_player2 
CHECK (player1_id != player2_id OR player1_id IS NULL OR player2_id IS NULL);

-- Create a function to validate game creation
CREATE OR REPLACE FUNCTION validate_game_creation()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if player1 is already in another active game
    IF NEW.player1_id IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM games 
            WHERE (player1_id = NEW.player1_id OR player2_id = NEW.player1_id)
            AND status IN ('waiting', 'active')
            AND id != NEW.id
        ) THEN
            RAISE EXCEPTION 'Player % is already in another active game', NEW.player1_id;
        END IF;
    END IF;
    
    -- Check if player2 is already in another active game
    IF NEW.player2_id IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM games 
            WHERE (player1_id = NEW.player2_id OR player2_id = NEW.player2_id)
            AND status IN ('waiting', 'active')
            AND id != NEW.id
        ) THEN
            RAISE EXCEPTION 'Player % is already in another active game', NEW.player2_id;
        END IF;
    END IF;
    
    -- Check if player1 and player2 are the same
    IF NEW.player1_id = NEW.player2_id AND NEW.player1_id IS NOT NULL THEN
        RAISE EXCEPTION 'Player cannot play against themselves';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate game creation
DROP TRIGGER IF EXISTS trigger_validate_game_creation ON games;
CREATE TRIGGER trigger_validate_game_creation
    BEFORE INSERT OR UPDATE ON games
    FOR EACH ROW
    EXECUTE FUNCTION validate_game_creation();

-- Update the matchmaking function to handle conflicts gracefully
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
                -- Check if either player is already in a game
                IF NOT EXISTS (
                    SELECT 1 FROM games 
                    WHERE (player1_id IN (player1.user_id, player2.user_id) 
                           OR player2_id IN (player1.user_id, player2.user_id))
                    AND status IN ('waiting', 'active')
                ) THEN
                    -- Create a game
                    BEGIN
                        INSERT INTO games (player1_id, player2_id, status, current_player, created_at, updated_at)
                        VALUES (player1.user_id, player2.user_id, 'waiting', player1.user_id, NOW(), NOW())
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
                    -- One or both players are already in a game, remove them from queue
                    DELETE FROM game_queue WHERE user_id IN (player1.user_id, player2.user_id);
                    RAISE NOTICE 'Removed players from queue - already in game: % and %', player1.username, player2.username;
                END IF;
            END IF;
        END LOOP;
    END LOOP;
    
    -- Re-enable RLS
    SET LOCAL row_security = on;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add a function to clean up stale queue entries for players already in games
CREATE OR REPLACE FUNCTION cleanup_queue_for_active_players()
RETURNS INTEGER AS $$
DECLARE
    removed_count INTEGER := 0;
BEGIN
    -- Remove queue entries for players who are already in active games
    DELETE FROM game_queue 
    WHERE user_id IN (
        SELECT DISTINCT player1_id FROM games WHERE status IN ('waiting', 'active')
        UNION
        SELECT DISTINCT player2_id FROM games WHERE status IN ('waiting', 'active')
    );
    
    GET DIAGNOSTICS removed_count = ROW_COUNT;
    
    IF removed_count > 0 THEN
        RAISE NOTICE 'Removed % queue entries for players already in games', removed_count;
    END IF;
    
    RETURN removed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: Cron jobs are not available in Supabase, so we'll handle cleanup in the application layer
-- The cleanup_queue_for_active_players function can be called manually or from the application 