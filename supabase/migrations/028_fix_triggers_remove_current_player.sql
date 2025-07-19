-- Fix all triggers and functions that reference current_player column
-- This migration updates all the triggers that were created before current_player was removed

-- Fix the process_matchmaking function in game_queue trigger
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
                -- Create a game (removed current_player)
                INSERT INTO games (player1_id, player2_id, status, created_at, updated_at)
                VALUES (player1.user_id, player2.user_id, 'waiting', NOW(), NOW())
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

-- Recreate the trigger
CREATE TRIGGER trigger_process_matchmaking
    AFTER INSERT ON game_queue
    FOR EACH ROW
    EXECUTE FUNCTION process_matchmaking();

-- Fix the match creation notification trigger
DROP TRIGGER IF EXISTS trigger_match_creation_notification ON games;
DROP FUNCTION IF EXISTS notify_match_creation;
CREATE OR REPLACE FUNCTION notify_match_creation()
RETURNS TRIGGER AS $$
BEGIN
    -- Only notify when a new game is created (not when updated)
    IF TG_OP = 'INSERT' AND NEW.status = 'waiting' THEN
        -- Broadcast match found event
        PERFORM pg_notify(
            'matchmaking',
            json_build_object(
                'type', 'match_found',
                'game_id', NEW.id,
                'player1_id', NEW.player1_id,
                'player2_id', NEW.player2_id,
                'timestamp', extract(epoch from now())
            )::text
        );
        
        RAISE NOTICE 'Match creation notification sent for game %', NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the match creation notification trigger
CREATE TRIGGER trigger_match_creation_notification
    AFTER INSERT ON games
    FOR EACH ROW
    EXECUTE FUNCTION notify_match_creation();

-- Fix the match broadcast trigger
DROP TRIGGER IF EXISTS trigger_match_broadcast ON games;
DROP FUNCTION IF EXISTS broadcast_match_changes;
CREATE OR REPLACE FUNCTION broadcast_match_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Broadcast game state changes
    PERFORM pg_notify(
        'games',
        json_build_object(
            'type', 'game_update',
            'game_id', COALESCE(NEW.id, OLD.id),
            'old_status', OLD.status,
            'new_status', NEW.status,
            'timestamp', extract(epoch from now())
        )::text
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the match broadcast trigger
CREATE TRIGGER trigger_match_broadcast
    AFTER UPDATE ON games
    FOR EACH ROW
    EXECUTE FUNCTION broadcast_match_changes();

-- Fix the games broadcast trigger
DROP TRIGGER IF EXISTS trigger_games_broadcast ON games;
DROP FUNCTION IF EXISTS handle_games_broadcast_changes;
CREATE OR REPLACE FUNCTION handle_games_broadcast_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Broadcast game changes for real-time updates
    PERFORM pg_notify(
        'games_changes',
        json_build_object(
            'type', TG_OP,
            'table', TG_TABLE_NAME,
            'record', CASE 
                WHEN TG_OP = 'DELETE' THEN row_to_json(OLD)
                ELSE row_to_json(NEW)
            END,
            'timestamp', extract(epoch from now())
        )::text
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the games broadcast trigger
CREATE TRIGGER trigger_games_broadcast
    AFTER INSERT OR UPDATE OR DELETE ON games
    FOR EACH ROW
    EXECUTE FUNCTION handle_games_broadcast_changes();

-- Fix the realtime notifications trigger
DROP TRIGGER IF EXISTS trigger_realtime_notifications ON games;
DROP FUNCTION IF EXISTS handle_realtime_notifications;
CREATE OR REPLACE FUNCTION handle_realtime_notifications()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle real-time notifications for game changes
    IF TG_OP = 'INSERT' AND NEW.status = 'waiting' THEN
        -- Notify about new match
        PERFORM pg_notify(
            'matchmaking',
            json_build_object(
                'type', 'match_found',
                'game_id', NEW.id,
                'player1_id', NEW.player1_id,
                'player2_id', NEW.player2_id,
                'timestamp', extract(epoch from now())
            )::text
        );
    ELSIF TG_OP = 'UPDATE' THEN
        -- Notify about game status changes
        IF OLD.status != NEW.status THEN
            PERFORM pg_notify(
                'games',
                json_build_object(
                    'type', 'status_change',
                    'game_id', NEW.id,
                    'old_status', OLD.status,
                    'new_status', NEW.status,
                    'timestamp', extract(epoch from now())
                )::text
            );
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the realtime notifications trigger
CREATE TRIGGER trigger_realtime_notifications
    AFTER INSERT OR UPDATE ON games
    FOR EACH ROW
    EXECUTE FUNCTION handle_realtime_notifications();

-- Fix the game integrity constraints trigger
DROP TRIGGER IF EXISTS trigger_game_integrity ON games;
DROP FUNCTION IF EXISTS validate_game_integrity;
CREATE OR REPLACE FUNCTION validate_game_integrity()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate game integrity rules
    IF NEW.status = 'waiting' THEN
        -- Waiting games should have player1_id but no player2_id
        IF NEW.player1_id IS NULL THEN
            RAISE EXCEPTION 'Waiting games must have a player1_id';
        END IF;
        IF NEW.player2_id IS NOT NULL THEN
            RAISE EXCEPTION 'Waiting games cannot have a player2_id';
        END IF;
    ELSIF NEW.status = 'active' THEN
        -- Active games should have both players
        IF NEW.player1_id IS NULL OR NEW.player2_id IS NULL THEN
            RAISE EXCEPTION 'Active games must have both player1_id and player2_id';
        END IF;
    ELSIF NEW.status = 'finished' THEN
        -- Finished games should have completion tracking
        IF NEW.completion_type IS NULL THEN
            RAISE EXCEPTION 'Finished games must have a completion_type';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the game integrity trigger
CREATE TRIGGER trigger_game_integrity
    BEFORE INSERT OR UPDATE ON games
    FOR EACH ROW
    EXECUTE FUNCTION validate_game_integrity(); 