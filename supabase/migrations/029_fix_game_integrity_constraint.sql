-- Fix the game integrity constraint that's preventing matchmaking
-- The issue is that the constraint prevents waiting games from having player2_id,
-- but matchmaking needs to create games with both players in 'waiting' status

-- Drop the existing trigger and function
DROP TRIGGER IF EXISTS trigger_game_integrity ON games;
DROP FUNCTION IF EXISTS validate_game_integrity;

-- Create the corrected validation function
CREATE OR REPLACE FUNCTION validate_game_integrity()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate game integrity rules
    IF NEW.status = 'waiting' THEN
        -- Waiting games should have player1_id
        IF NEW.player1_id IS NULL THEN
            RAISE EXCEPTION 'Waiting games must have a player1_id';
        END IF;
        -- Waiting games can have player2_id (for matchmaking)
        -- This was the bug - waiting games created by matchmaking should have both players
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