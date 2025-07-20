-- Fix game validation triggers to allow matchmaking to create games
-- The current validation is too restrictive and prevents matchmaking from working

-- Drop the existing validation triggers
DROP TRIGGER IF EXISTS trigger_validate_game_creation ON games;
DROP TRIGGER IF EXISTS trigger_validate_game_status_update ON games;

-- Create a more intelligent validation function that allows matchmaking
CREATE OR REPLACE FUNCTION validate_game_creation()
RETURNS TRIGGER AS $$
BEGIN
    -- Only validate on INSERT operations, not UPDATE
    IF TG_OP = 'INSERT' THEN
        -- Check if player1 and player2 are the same
        IF NEW.player1_id = NEW.player2_id AND NEW.player1_id IS NOT NULL THEN
            RAISE EXCEPTION 'Player cannot play against themselves';
        END IF;
        
        -- For matchmaking-created games, we don't need to check if players are in active games
        -- because the matchmaking function already handles this logic
        -- The validation should only prevent manual game creation with conflicts
        
        -- Only check for active games if this is NOT a matchmaking-created game
        -- We can detect this by checking if both players are in the queue
        IF NOT EXISTS (
            SELECT 1 FROM game_queue 
            WHERE user_id IN (NEW.player1_id, NEW.player2_id)
        ) THEN
            -- This is a manual game creation, so validate player availability
            IF NEW.player1_id IS NOT NULL THEN
                IF EXISTS (
                    SELECT 1 FROM games 
                    WHERE (player1_id = NEW.player1_id OR player2_id = NEW.player1_id)
                    AND status IN ('waiting', 'active')
                ) THEN
                    RAISE EXCEPTION 'Player % is already in another active game', NEW.player1_id;
                END IF;
            END IF;
            
            IF NEW.player2_id IS NOT NULL THEN
                IF EXISTS (
                    SELECT 1 FROM games 
                    WHERE (player1_id = NEW.player2_id OR player2_id = NEW.player2_id)
                    AND status IN ('waiting', 'active')
                ) THEN
                    RAISE EXCEPTION 'Player % is already in another active game', NEW.player2_id;
                END IF;
            END IF;
        ELSE
            -- This is a matchmaking-created game, log it for debugging
            RAISE NOTICE 'Matchmaking game creation validated for players: % vs %', NEW.player1_id, NEW.player2_id;
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

-- Simplify the status update validation to be less restrictive
CREATE OR REPLACE FUNCTION validate_game_status_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Only validate when status is being set to 'waiting' or 'active'
    IF NEW.status IN ('waiting', 'active') AND OLD.status != NEW.status THEN
        -- Check if player1 is already in another active game (excluding this game)
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
        
        -- Check if player2 is already in another active game (excluding this game)
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