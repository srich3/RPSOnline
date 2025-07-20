-- Fix and ensure the Supabase Realtime broadcast system is working
-- Drop existing functions and recreate them with proper realtime.broadcast_changes usage

-- Drop existing triggers first
DROP TRIGGER IF EXISTS trigger_broadcast_match_acceptance ON games;
DROP TRIGGER IF EXISTS trigger_broadcast_match_decline ON games;

-- Drop existing functions
DROP FUNCTION IF EXISTS broadcast_match_acceptance();
DROP FUNCTION IF EXISTS broadcast_match_decline();

-- Create a function to broadcast match acceptance using realtime.broadcast_changes
CREATE OR REPLACE FUNCTION broadcast_match_acceptance()
RETURNS TRIGGER AS $$
BEGIN
    -- Broadcast when a player accepts a match (player1_accepted or player2_accepted changes to true)
    IF TG_OP = 'UPDATE' AND OLD.status = 'waiting' AND NEW.status = 'waiting' THEN
        -- Check if this is an acceptance (either player1_accepted or player2_accepted changed to true)
        IF (OLD.player1_accepted = false AND NEW.player1_accepted = true) OR
           (OLD.player2_accepted = false AND NEW.player2_accepted = true) THEN
            
            -- Broadcast the acceptance event using Supabase Realtime
            PERFORM realtime.broadcast_changes(
                'matchmaking',                                    -- topic - broadcast to matchmaking channel
                'match_accepted',                                 -- event - custom event type
                'UPDATE',                                         -- operation - UPDATE
                TG_TABLE_NAME,                                    -- table - games
                TG_TABLE_SCHEMA,                                  -- schema - public
                NEW,                                              -- new record - updated game
                OLD                                               -- old record - previous game state
            );
            
            RAISE NOTICE 'Broadcasted match acceptance for game %', NEW.id;
        END IF;
        
        -- Check if both players have accepted (game should start)
        IF NEW.player1_accepted = true AND NEW.player2_accepted = true THEN
            -- Update game status to active
            UPDATE games 
            SET status = 'active', updated_at = NOW()
            WHERE id = NEW.id;
            
            -- Broadcast that the game is starting
            PERFORM realtime.broadcast_changes(
                'matchmaking',                                    -- topic - broadcast to matchmaking channel
                'game_starting',                                  -- event - custom event type
                'UPDATE',                                         -- operation - UPDATE
                TG_TABLE_NAME,                                    -- table - games
                TG_TABLE_SCHEMA,                                  -- schema - public
                NEW,                                              -- new record - updated game
                OLD                                               -- old record - previous game state
            );
            
            RAISE NOTICE 'Broadcasted game starting for game %', NEW.id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to broadcast match decline/cancellation using realtime.broadcast_changes
CREATE OR REPLACE FUNCTION broadcast_match_decline()
RETURNS TRIGGER AS $$
BEGIN
    -- Broadcast when a game is canceled (status changes from 'waiting' to 'canceled')
    IF TG_OP = 'UPDATE' AND OLD.status = 'waiting' AND NEW.status = 'canceled' THEN
        
        -- Broadcast the decline event using Supabase Realtime
        PERFORM realtime.broadcast_changes(
            'matchmaking',                                    -- topic - broadcast to matchmaking channel
            'match_declined',                                 -- event - custom event type
            'UPDATE',                                         -- operation - UPDATE
            TG_TABLE_NAME,                                    -- table - games
            TG_TABLE_SCHEMA,                                  -- schema - public
            NEW,                                              -- new record - updated game
            OLD                                               -- old record - previous game state
        );
        
        RAISE NOTICE 'Broadcasted match decline for game %', NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for the broadcast functions
CREATE TRIGGER trigger_broadcast_match_acceptance
    AFTER UPDATE ON games
    FOR EACH ROW
    EXECUTE FUNCTION broadcast_match_acceptance();

CREATE TRIGGER trigger_broadcast_match_decline
    AFTER UPDATE ON games
    FOR EACH ROW
    EXECUTE FUNCTION broadcast_match_decline();

-- Enable real-time for the games table if not already enabled
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'games'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE games;
    END IF;
END $$; 