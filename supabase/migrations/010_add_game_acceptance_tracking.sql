-- Add acceptance tracking to games table
-- This allows both players to accept before the game becomes active

-- Add acceptance tracking columns
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS player1_accepted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS player2_accepted BOOLEAN DEFAULT FALSE;

-- Update existing games to have both players accepted if they're active
UPDATE games 
SET player1_accepted = TRUE, player2_accepted = TRUE 
WHERE status = 'active';

-- Create a function to handle game acceptance
CREATE OR REPLACE FUNCTION handle_game_acceptance()
RETURNS TRIGGER AS $$
BEGIN
    -- Only process if this is an acceptance update
    IF NEW.player1_accepted = TRUE OR NEW.player2_accepted = TRUE THEN
        -- Check if both players have accepted
        IF NEW.player1_accepted = TRUE AND NEW.player2_accepted = TRUE THEN
            -- Both players accepted, activate the game
            NEW.status = 'active';
            NEW.updated_at = NOW();
            
            RAISE NOTICE 'Both players accepted game %, activating...', NEW.id;
        ELSE
            -- Only one player accepted, keep status as waiting
            NEW.status = 'waiting';
            NEW.updated_at = NOW();
            
            RAISE NOTICE 'Player accepted game %, waiting for other player...', NEW.id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to handle acceptance
DROP TRIGGER IF EXISTS trigger_handle_game_acceptance ON games;
CREATE TRIGGER trigger_handle_game_acceptance
    BEFORE UPDATE ON games
    FOR EACH ROW
    EXECUTE FUNCTION handle_game_acceptance();

-- Update the acceptMatch function to use acceptance tracking
CREATE OR REPLACE FUNCTION accept_match(game_id UUID, player_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    game_record RECORD;
    is_player1 BOOLEAN;
BEGIN
    -- Get the game
    SELECT * INTO game_record FROM games WHERE id = game_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Game not found: %', game_id;
    END IF;
    
    -- Check if player is a participant
    IF game_record.player1_id != player_id AND game_record.player2_id != player_id THEN
        RAISE EXCEPTION 'Player % is not a participant in game %', player_id, game_id;
    END IF;
    
    -- Determine which player this is
    is_player1 := (game_record.player1_id = player_id);
    
    -- Update the appropriate acceptance field
    IF is_player1 THEN
        UPDATE games 
        SET player1_accepted = TRUE, updated_at = NOW()
        WHERE id = game_id;
    ELSE
        UPDATE games 
        SET player2_accepted = TRUE, updated_at = NOW()
        WHERE id = game_id;
    END IF;
    
    RAISE NOTICE 'Player % accepted game %', player_id, game_id;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION accept_match(UUID, UUID) TO authenticated; 