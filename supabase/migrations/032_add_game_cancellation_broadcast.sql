-- Add broadcast notification when a game is canceled
-- This ensures both players get real-time updates when a match is declined

-- Create a trigger function to broadcast game cancellations
CREATE OR REPLACE FUNCTION broadcast_game_cancellation()
RETURNS TRIGGER AS $$
BEGIN
    -- Only broadcast when a game is canceled (status changes to finished with completion_type = 'canceled')
    IF TG_OP = 'UPDATE' AND NEW.status = 'finished' AND NEW.completion_type = 'canceled' AND OLD.status = 'waiting' THEN
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

-- Create trigger for game cancellation broadcasts
DROP TRIGGER IF EXISTS trigger_broadcast_game_cancellation ON games;
CREATE TRIGGER trigger_broadcast_game_cancellation
    AFTER UPDATE ON games
    FOR EACH ROW
    EXECUTE FUNCTION broadcast_game_cancellation(); 