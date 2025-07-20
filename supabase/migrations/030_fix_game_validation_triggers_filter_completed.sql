-- Fix the game validation triggers to filter out completed/canceled games
-- The current triggers don't exclude completed games, causing issues when players try to join queue after a game is canceled

-- Drop the existing triggers
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
                AND completion_type IS NULL -- Only include games that haven't been completed/canceled
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
                AND completion_type IS NULL -- Only include games that haven't been completed/canceled
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
                AND completion_type IS NULL -- Only include games that haven't been completed/canceled
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
                AND completion_type IS NULL -- Only include games that haven't been completed/canceled
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