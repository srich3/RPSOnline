-- Fix ALL remaining completion_type references in the database
-- This migration will clean up any lingering references to the removed completion_type column

-- 1. Drop and recreate all triggers that might reference completion_type
DROP TRIGGER IF EXISTS trigger_process_matchmaking ON game_queue;
DROP TRIGGER IF EXISTS trigger_validate_game_completion ON games;
DROP TRIGGER IF EXISTS trigger_broadcast_game_changes ON games;
DROP TRIGGER IF EXISTS trigger_cleanup_old_games ON games;

-- 2. Drop all functions that might reference completion_type
DROP FUNCTION IF EXISTS process_matchmaking();
DROP FUNCTION IF EXISTS validate_game_completion();
DROP FUNCTION IF EXISTS broadcast_game_changes();
DROP FUNCTION IF EXISTS cleanup_old_games();
DROP FUNCTION IF EXISTS cancel_game(UUID, UUID);
DROP FUNCTION IF EXISTS forfeit_game(UUID, UUID);
DROP FUNCTION IF EXISTS get_player_achievement_stats(UUID);

-- 3. Recreate the matchmaking function without completion_type references
CREATE OR REPLACE FUNCTION process_matchmaking()
RETURNS TRIGGER AS $$
DECLARE
    compatible_player RECORD;
    game_id UUID;
BEGIN
    -- Log that the trigger fired
    RAISE NOTICE '🎯 MATCHMAKING TRIGGER FIRED for user: % (rating: %)', NEW.user_id, NEW.rating;
    
    -- Temporarily disable RLS for this function
    SET LOCAL row_security = off;
    
    -- Find a compatible player with simple SELECT query
    -- Look for oldest player in queue with compatible rating (within 300 points)
    SELECT 
        q.user_id,
        q.rating,
        q.created_at
    INTO compatible_player
    FROM game_queue q
    WHERE q.user_id != NEW.user_id  -- Not the same player
    AND ABS(q.rating - NEW.rating) <= 300  -- Within 300 rating points
    AND NOT EXISTS (  -- Not already in an active game
        SELECT 1 FROM games g
        WHERE (g.player1_id = q.user_id OR g.player2_id = q.user_id)
        AND g.status IN ('waiting', 'active')
    )
    ORDER BY q.created_at ASC  -- Oldest first
    LIMIT 1;  -- Just get the first compatible player
    
    -- If we found a compatible player, create a game
    IF compatible_player.user_id IS NOT NULL THEN
        RAISE NOTICE '🎯 Found compatible player: % (rating: %) vs % (rating: %)', 
            NEW.user_id, NEW.rating, compatible_player.user_id, compatible_player.rating;
        
        -- Create the game
        BEGIN
            INSERT INTO games (player1_id, player2_id, status, created_at, updated_at)
            VALUES (NEW.user_id, compatible_player.user_id, 'waiting', NOW(), NOW())
            RETURNING id INTO game_id;
            
            RAISE NOTICE '🎮 Game created successfully: %', game_id;
            
            -- Remove both players from queue
            DELETE FROM game_queue 
            WHERE user_id IN (NEW.user_id, compatible_player.user_id);
            
            RAISE NOTICE '✅ Players removed from queue: % and %', NEW.user_id, compatible_player.user_id;
            
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE '❌ Failed to create game: %', SQLERRM;
        END;
    ELSE
        RAISE NOTICE '⏳ No compatible player found for % (rating: %), waiting...', NEW.user_id, NEW.rating;
    END IF;
    
    -- Re-enable RLS
    SET LOCAL row_security = on;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Recreate the game validation function without completion_type references
CREATE OR REPLACE FUNCTION validate_game_completion()
RETURNS TRIGGER AS $$
BEGIN
    -- Only validate if this is a matchmaking-created game (no manual validation needed)
    IF NEW.status = 'waiting' THEN
        RETURN NEW;
    END IF;
    
    -- For finished games, ensure they have proper completion data
    IF NEW.status = 'finished' THEN
        -- Game must have either a winner, be forfeited, or be canceled
        IF NEW.winner_id IS NULL AND NEW.forfeited_by IS NULL AND NEW.canceled_by IS NULL THEN
            RAISE EXCEPTION 'Finished games must have a winner, be forfeited, or be canceled';
        END IF;
        
        -- If there's a winner, ensure it's one of the players
        IF NEW.winner_id IS NOT NULL THEN
            IF NEW.winner_id != NEW.player1_id AND NEW.winner_id != NEW.player2_id THEN
                RAISE EXCEPTION 'Winner must be one of the game players';
            END IF;
        END IF;
        
        -- If forfeited, ensure forfeited_by is one of the players
        IF NEW.forfeited_by IS NOT NULL THEN
            IF NEW.forfeited_by != NEW.player1_id AND NEW.forfeited_by != NEW.player2_id THEN
                RAISE EXCEPTION 'Forfeited by must be one of the game players';
            END IF;
        END IF;
        
        -- If canceled, ensure canceled_by is one of the players
        IF NEW.canceled_by IS NOT NULL THEN
            IF NEW.canceled_by != NEW.player1_id AND NEW.canceled_by != NEW.player2_id THEN
                RAISE EXCEPTION 'Canceled by must be one of the game players';
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Recreate the broadcast function without completion_type references
CREATE OR REPLACE FUNCTION broadcast_game_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Broadcast game changes for real-time updates
    IF TG_OP = 'INSERT' THEN
        PERFORM realtime.broadcast_changes(
            'game_created',
            json_build_object(
                'game_id', NEW.id,
                'player1_id', NEW.player1_id,
                'player2_id', NEW.player2_id,
                'status', NEW.status
            ),
            'games'
        );
    ELSIF TG_OP = 'UPDATE' THEN
        -- Broadcast status changes
        IF OLD.status != NEW.status THEN
            PERFORM realtime.broadcast_changes(
                'game_status_changed',
                json_build_object(
                    'game_id', NEW.id,
                    'old_status', OLD.status,
                    'new_status', NEW.status,
                    'winner_id', NEW.winner_id,
                    'forfeited_by', NEW.forfeited_by,
                    'canceled_by', NEW.canceled_by
                ),
                'games'
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Recreate the cancel game function without completion_type references
CREATE OR REPLACE FUNCTION cancel_game(game_id UUID, canceled_by_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    game_record RECORD;
BEGIN
    -- Get the game
    SELECT * INTO game_record FROM games WHERE id = game_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Game not found';
    END IF;
    
    -- Check if user is a player in the game
    IF canceled_by_user_id != game_record.player1_id AND canceled_by_user_id != game_record.player2_id THEN
        RAISE EXCEPTION 'Only game players can cancel a game';
    END IF;
    
    -- Check if game can be canceled
    IF game_record.status != 'waiting' AND game_record.status != 'active' THEN
        RAISE EXCEPTION 'Game cannot be canceled in its current state';
    END IF;
    
    -- Cancel the game
    UPDATE games 
    SET 
        status = 'finished',
        canceled_by = canceled_by_user_id,
        updated_at = NOW()
    WHERE id = game_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Recreate the forfeit game function without completion_type references
CREATE OR REPLACE FUNCTION forfeit_game(game_id UUID, forfeited_by_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    game_record RECORD;
    winner_id UUID;
BEGIN
    -- Get the game
    SELECT * INTO game_record FROM games WHERE id = game_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Game not found';
    END IF;
    
    -- Check if user is a player in the game
    IF forfeited_by_user_id != game_record.player1_id AND forfeited_by_user_id != game_record.player2_id THEN
        RAISE EXCEPTION 'Only game players can forfeit a game';
    END IF;
    
    -- Check if game can be forfeited
    IF game_record.status != 'waiting' AND game_record.status != 'active' THEN
        RAISE EXCEPTION 'Game cannot be forfeited in its current state';
    END IF;
    
    -- Determine winner (the other player)
    IF forfeited_by_user_id = game_record.player1_id THEN
        winner_id := game_record.player2_id;
    ELSE
        winner_id := game_record.player1_id;
    END IF;
    
    -- Forfeit the game
    UPDATE games 
    SET 
        status = 'finished',
        winner_id = winner_id,
        forfeited_by = forfeited_by_user_id,
        updated_at = NOW()
    WHERE id = game_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Recreate the achievement stats function without completion_type references
CREATE OR REPLACE FUNCTION get_player_achievement_stats(player_id UUID)
RETURNS TABLE(
    total_games INTEGER,
    wins INTEGER,
    losses INTEGER,
    win_rate NUMERIC,
    games_played INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_games,
        COUNT(CASE WHEN winner_id = player_id THEN 1 END)::INTEGER as wins,
        COUNT(CASE WHEN status = 'finished' AND winner_id != player_id AND winner_id IS NOT NULL THEN 1 END)::INTEGER as losses,
        CASE 
            WHEN COUNT(CASE WHEN status = 'finished' AND winner_id IS NOT NULL THEN 1 END) > 0 
            THEN ROUND(
                (COUNT(CASE WHEN winner_id = player_id THEN 1 END)::NUMERIC / 
                 COUNT(CASE WHEN status = 'finished' AND winner_id IS NOT NULL THEN 1 END)::NUMERIC) * 100, 2
            )
            ELSE 0 
        END as win_rate,
        COUNT(CASE WHEN status = 'finished' THEN 1 END)::INTEGER as games_played
    FROM games 
    WHERE (player1_id = player_id OR player2_id = player_id)
    AND status = 'finished';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Recreate all triggers
CREATE TRIGGER trigger_process_matchmaking
    AFTER INSERT ON game_queue
    FOR EACH ROW
    EXECUTE FUNCTION process_matchmaking();

CREATE TRIGGER trigger_validate_game_completion
    BEFORE INSERT OR UPDATE ON games
    FOR EACH ROW
    EXECUTE FUNCTION validate_game_completion();

CREATE TRIGGER trigger_broadcast_game_changes
    AFTER INSERT OR UPDATE ON games
    FOR EACH ROW
    EXECUTE FUNCTION broadcast_game_changes();

-- 10. Ensure the games table doesn't have any completion_type references
-- (This should already be done, but let's make sure)
DO $$
BEGIN
    -- Check if completion_type column still exists and drop it if it does
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'games' AND column_name = 'completion_type'
    ) THEN
        ALTER TABLE games DROP COLUMN completion_type;
    END IF;
    
    -- Drop any constraints that might reference completion_type
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'games' AND constraint_name = 'check_completion_type'
    ) THEN
        ALTER TABLE games DROP CONSTRAINT check_completion_type;
    END IF;
    
    -- Drop any indexes that might reference completion_type
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'games' AND indexname = 'idx_games_completion_type'
    ) THEN
        DROP INDEX idx_games_completion_type;
    END IF;
END $$; 