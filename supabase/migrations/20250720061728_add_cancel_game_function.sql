-- Add the missing cancel_game function that was dropped in migration 059
-- This function is needed for declining matches

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
    
    -- Mark game as canceled using status only (no completion_type)
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION cancel_game(UUID, UUID) TO authenticated; 