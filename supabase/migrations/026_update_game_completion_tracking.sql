-- Update games table for better completion tracking and achievement support
-- Remove current_player (both players play simultaneously)
-- Add completion tracking with different completion types

-- First, drop the current_player column and its foreign key constraint
ALTER TABLE games DROP COLUMN IF EXISTS current_player;

-- Add completion tracking columns
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS completion_type VARCHAR(50) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS forfeited_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS canceled_by UUID REFERENCES users(id);

-- Add check constraint to ensure valid completion types
ALTER TABLE games 
ADD CONSTRAINT check_completion_type 
CHECK (completion_type IS NULL OR completion_type IN ('winner_determined', 'forfeit', 'canceled'));

-- Add constraint to ensure completion fields are consistent
ALTER TABLE games 
ADD CONSTRAINT check_completion_consistency 
CHECK (
  (completion_type IS NULL) OR
  (completion_type = 'winner_determined' AND winner_id IS NOT NULL AND forfeited_by IS NULL AND canceled_by IS NULL) OR
  (completion_type = 'forfeit' AND winner_id IS NULL AND forfeited_by IS NOT NULL AND canceled_by IS NULL) OR
  (completion_type = 'canceled' AND winner_id IS NULL AND forfeited_by IS NULL AND canceled_by IS NOT NULL)
);

-- Update existing completed games to have proper completion tracking
UPDATE games 
SET 
  completion_type = CASE 
    WHEN winner_id IS NOT NULL THEN 'winner_determined'
    ELSE NULL
  END,
  completed_at = CASE 
    WHEN winner_id IS NOT NULL THEN updated_at
    ELSE NULL
  END
WHERE status = 'finished';

-- Create indexes for achievement queries
CREATE INDEX IF NOT EXISTS idx_games_completion_type ON games(completion_type);
CREATE INDEX IF NOT EXISTS idx_games_forfeited_by ON games(forfeited_by);
CREATE INDEX IF NOT EXISTS idx_games_canceled_by ON games(canceled_by);
CREATE INDEX IF NOT EXISTS idx_games_completed_at ON games(completed_at);

-- Create a function to mark game as forfeited
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
    
    -- Mark game as forfeited
    UPDATE games 
    SET 
        status = 'finished',
        completion_type = 'forfeit',
        forfeited_by = player_id,
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = game_id;
    
    RAISE NOTICE 'Game % forfeited by player %', game_id, player_id;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to cancel a game before it starts
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
    
    -- Mark game as canceled
    UPDATE games 
    SET 
        status = 'finished',
        completion_type = 'canceled',
        canceled_by = player_id,
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = game_id;
    
    RAISE NOTICE 'Game % canceled by player %', game_id, player_id;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION forfeit_game(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_game(UUID, UUID) TO authenticated;

-- Create helper functions for achievement tracking
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
    AND completion_type IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_player_achievement_stats(UUID) TO authenticated; 