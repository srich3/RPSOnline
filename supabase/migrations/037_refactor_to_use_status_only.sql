-- Refactor games table to use only status column instead of status + completion_type
-- This eliminates redundancy and confusion between the two fields

-- Drop the old status check constraint first
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_status_check;

-- First, update existing games to have the correct status values
UPDATE games 
SET status = CASE 
    WHEN completion_type = 'winner_determined' THEN 'winner_determined'
    WHEN completion_type = 'forfeit' THEN 'forfeit'
    WHEN completion_type = 'canceled' THEN 'canceled'
    ELSE status
END
WHERE completion_type IS NOT NULL;

-- Add the new status values to the check constraint
ALTER TABLE games 
DROP CONSTRAINT IF EXISTS check_game_status;

ALTER TABLE games 
ADD CONSTRAINT check_game_status 
CHECK (status IN ('waiting', 'active', 'finished', 'forfeit', 'winner_determined', 'canceled'));

-- Drop the completion_type column and related constraints
ALTER TABLE games DROP COLUMN IF EXISTS completion_type;

-- Drop the completion consistency constraint since we no longer have completion_type
ALTER TABLE games DROP CONSTRAINT IF EXISTS check_completion_consistency;

-- Update the cancel_game function to use status instead of completion_type
CREATE OR REPLACE FUNCTION cancel_game(game_id UUID, player_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    game_record RECORD;
BEGIN
    -- Get the game
    SELECT * INTO game_record FROM games WHERE id = game_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Game not found: %', game_id;
    END IF;
    
    -- Check if game is still waiting (not started)
    IF game_record.status != 'waiting' THEN
        RAISE EXCEPTION 'Game has already started: %', game_id;
    END IF;
    
    -- Check if player is a participant
    IF game_record.player1_id != player_id AND game_record.player2_id != player_id THEN
        RAISE EXCEPTION 'Player % is not a participant in game %', player_id, game_id;
    END IF;
    
    -- Mark game as canceled using status
    UPDATE games 
    SET 
        status = 'canceled',
        canceled_by = player_id,
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = game_id;
    
    RAISE NOTICE 'Game % canceled by player %', game_id, player_id;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the forfeit_game function to use status instead of completion_type
CREATE OR REPLACE FUNCTION forfeit_game(game_id UUID, player_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    game_record RECORD;
    other_player_id UUID;
BEGIN
    -- Get the game
    SELECT * INTO game_record FROM games WHERE id = game_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Game not found: %', game_id;
    END IF;
    
    -- Check if game is active
    IF game_record.status != 'active' THEN
        RAISE EXCEPTION 'Game is not active: %', game_id;
    END IF;
    
    -- Check if player is a participant
    IF game_record.player1_id != player_id AND game_record.player2_id != player_id THEN
        RAISE EXCEPTION 'Player % is not a participant in game %', player_id, game_id;
    END IF;
    
    -- Determine the other player
    other_player_id := CASE 
        WHEN game_record.player1_id = player_id THEN game_record.player2_id
        ELSE game_record.player1_id
    END;
    
    -- Mark game as forfeited using status
    UPDATE games 
    SET 
        status = 'forfeit',
        forfeited_by = player_id,
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = game_id;
    
    RAISE NOTICE 'Game % forfeited by player %', game_id, player_id;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the get_player_achievement_stats function to use status instead of completion_type
CREATE OR REPLACE FUNCTION get_player_achievement_stats(player_id UUID)
RETURNS TABLE(
    total_games_played INTEGER,
    games_won INTEGER,
    games_lost INTEGER,
    games_forfeited INTEGER,
    games_canceled INTEGER,
    opponents_forfeited INTEGER,
    opponents_canceled INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_games_played,
        COUNT(CASE WHEN winner_id = player_id THEN 1 END)::INTEGER as games_won,
        COUNT(CASE WHEN winner_id IS NOT NULL AND winner_id != player_id THEN 1 END)::INTEGER as games_lost,
        COUNT(CASE WHEN forfeited_by = player_id THEN 1 END)::INTEGER as games_forfeited,
        COUNT(CASE WHEN canceled_by = player_id THEN 1 END)::INTEGER as games_canceled,
        COUNT(CASE WHEN forfeited_by IS NOT NULL AND forfeited_by != player_id THEN 1 END)::INTEGER as opponents_forfeited,
        COUNT(CASE WHEN canceled_by IS NOT NULL AND canceled_by != player_id THEN 1 END)::INTEGER as opponents_canceled
    FROM games 
    WHERE (player1_id = player_id OR player2_id = player_id)
    AND status IN ('finished', 'forfeit', 'winner_determined', 'canceled');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the game integrity validation trigger to use status only
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
    ELSIF NEW.status IN ('finished', 'forfeit', 'winner_determined', 'canceled') THEN
        -- Completed games should have appropriate tracking fields
        IF NEW.status = 'winner_determined' AND NEW.winner_id IS NULL THEN
            RAISE EXCEPTION 'Winner determined games must have a winner_id';
        END IF;
        IF NEW.status = 'forfeit' AND NEW.forfeited_by IS NULL THEN
            RAISE EXCEPTION 'Forfeit games must have a forfeited_by';
        END IF;
        IF NEW.status = 'canceled' AND NEW.canceled_by IS NULL THEN
            RAISE EXCEPTION 'Canceled games must have a canceled_by';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the broadcast trigger to handle the new status values
CREATE OR REPLACE FUNCTION broadcast_game_cancellation()
RETURNS TRIGGER AS $$
BEGIN
    -- Only broadcast when a game is canceled (status changes to canceled)
    IF TG_OP = 'UPDATE' AND NEW.status = 'canceled' AND OLD.status = 'waiting' THEN
        -- Broadcast match declined event using realtime.broadcast_changes
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

-- Drop the old completion_type index since we no longer have that column
DROP INDEX IF EXISTS idx_games_completion_type;

-- Create new index for the updated status values
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status); 