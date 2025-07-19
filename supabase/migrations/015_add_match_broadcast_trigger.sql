-- Add trigger to broadcast match creation to both players
-- This will ensure both players get notified when a match is found

-- Create a function to broadcast match creation
CREATE OR REPLACE FUNCTION broadcast_match_created()
RETURNS TRIGGER AS $$
BEGIN
    -- This function will be called after a game is inserted
    -- The client will detect the INSERT event and handle the match found notification
    -- No need for additional broadcasting since the INSERT event is sufficient
    
    -- Log the match creation for debugging
    RAISE NOTICE 'Match created: Game ID % for players % and %', 
        NEW.id, NEW.player1_id, NEW.player2_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to call the broadcast function
DROP TRIGGER IF EXISTS trigger_broadcast_match_created ON games;
CREATE TRIGGER trigger_broadcast_match_created
    AFTER INSERT ON games
    FOR EACH ROW
    EXECUTE FUNCTION broadcast_match_created(); 