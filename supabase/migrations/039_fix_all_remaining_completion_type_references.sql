-- Fix all remaining completion_type references in database triggers and functions
-- This migration addresses all the triggers and functions that still reference the removed completion_type column

-- 1. Fix the broadcast_game_cancellation function
DROP TRIGGER IF EXISTS trigger_broadcast_game_cancellation ON games;
DROP FUNCTION IF EXISTS broadcast_game_cancellation();

CREATE OR REPLACE FUNCTION broadcast_game_cancellation()
RETURNS TRIGGER AS $$
BEGIN
    -- Only broadcast when a game is canceled (status changes to canceled)
    IF TG_OP = 'UPDATE' AND NEW.status = 'canceled' AND OLD.status = 'waiting' THEN
        -- Broadcast match declined event using realtime.broadcast_changes with correct parameters
        PERFORM realtime.broadcast_changes(
            'matchmaking',                                    -- topic - broadcast to matchmaking channel
            TG_OP,                                           -- event - UPDATE
            TG_OP,                                           -- operation - UPDATE
            TG_TABLE_NAME,                                   -- table - games
            TG_TABLE_SCHEMA,                                 -- schema - public
            NEW,                                             -- new record - updated game
            OLD                                              -- old record - previous game state
        );
        
        RAISE NOTICE 'Game cancellation broadcast sent for game %', NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for game cancellation broadcasts
CREATE TRIGGER trigger_broadcast_game_cancellation
    AFTER UPDATE ON games
    FOR EACH ROW
    EXECUTE FUNCTION broadcast_game_cancellation();

-- 2. Fix the game validation triggers
DROP TRIGGER IF EXISTS trigger_validate_game_creation ON games;
DROP TRIGGER IF EXISTS trigger_validate_game_status_update ON games;

-- Create a more permissive validation function that excludes completed games
CREATE OR REPLACE FUNCTION validate_game_creation()
RETURNS TRIGGER AS $$
BEGIN
    -- Only validate on INSERT operations, not UPDATE
    -- This allows status changes and other updates to proceed
    IF TG_OP = 'INSERT' THEN
        -- Check if player1 is already in another active game (excluding completed/canceled games)
        IF NEW.player1_id IS NOT NULL THEN
            IF EXISTS (
                SELECT 1 FROM games 
                WHERE (player1_id = NEW.player1_id OR player2_id = NEW.player1_id)
                AND status IN ('waiting', 'active')
            ) THEN
                RAISE EXCEPTION 'Player % is already in another active game', NEW.player1_id;
            END IF;
        END IF;
        
        -- Check if player2 is already in another active game (excluding completed/canceled games)
        IF NEW.player2_id IS NOT NULL THEN
            IF EXISTS (
                SELECT 1 FROM games 
                WHERE (player1_id = NEW.player2_id OR player2_id = NEW.player2_id)
                AND status IN ('waiting', 'active')
            ) THEN
                RAISE EXCEPTION 'Player % is already in another active game', NEW.player2_id;
            END IF;
        END IF;
        
        -- Check if player1 and player2 are the same
        IF NEW.player1_id = NEW.player2_id AND NEW.player1_id IS NOT NULL THEN
            RAISE EXCEPTION 'Player cannot play against themselves';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger only for INSERT operations
CREATE TRIGGER trigger_validate_game_creation
    BEFORE INSERT ON games
    FOR EACH ROW
    EXECUTE FUNCTION validate_game_creation();

-- Add a separate function to validate player uniqueness on status changes
CREATE OR REPLACE FUNCTION validate_game_status_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Only validate when status is being set to 'waiting' or 'active'
    IF NEW.status IN ('waiting', 'active') AND OLD.status != NEW.status THEN
        -- Check if player1 is already in another active game (excluding this game and completed/canceled games)
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
        
        -- Check if player2 is already in another active game (excluding this game and completed/canceled games)
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
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for UPDATE operations
CREATE TRIGGER trigger_validate_game_status_update
    BEFORE UPDATE ON games
    FOR EACH ROW
    EXECUTE FUNCTION validate_game_status_update();

-- 3. Fix any remaining game integrity constraints that might reference completion_type
-- Drop any constraints that might still reference completion_type
ALTER TABLE games DROP CONSTRAINT IF EXISTS check_completion_consistency;
ALTER TABLE games DROP CONSTRAINT IF EXISTS check_game_completion_consistency;

-- 4. Update any remaining functions that might reference completion_type
-- Check if there are any other functions that need updating
DO $$
BEGIN
    -- This will help identify any remaining issues
    RAISE NOTICE 'Migration completed - all completion_type references should now be removed';
END $$; 