-- Fix the broadcast triggers to use realtime.broadcast_changes instead of pg_notify
-- This ensures the frontend receives real-time updates properly

-- Drop the old triggers and functions
DROP TRIGGER IF EXISTS trigger_games_broadcast ON games;
DROP TRIGGER IF EXISTS trigger_realtime_notifications ON games;
DROP TRIGGER IF EXISTS trigger_match_broadcast ON games;
DROP TRIGGER IF EXISTS trigger_match_creation_notification ON games;
DROP TRIGGER IF EXISTS handle_games_broadcast_changes ON games;

DROP FUNCTION IF EXISTS handle_games_broadcast_changes();
DROP FUNCTION IF EXISTS handle_realtime_notifications();
DROP FUNCTION IF EXISTS broadcast_match_changes();
DROP FUNCTION IF EXISTS notify_match_creation();

-- Create the correct broadcast function using realtime.broadcast_changes
CREATE OR REPLACE FUNCTION public.games_broadcast_changes()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Broadcast game events to both players
  IF TG_OP = 'INSERT' THEN
    -- New game created - broadcast to both players
    PERFORM realtime.broadcast_changes(
      'matchmaking',                                    -- topic - broadcast to matchmaking channel
      TG_OP,                                           -- event - INSERT
      TG_OP,                                           -- operation - INSERT
      TG_TABLE_NAME,                                   -- table - games
      TG_TABLE_SCHEMA,                                 -- schema - public
      NEW,                                             -- new record - the new game
      NULL                                             -- old record - no old record for INSERT
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Game updated (e.g., acceptance, cancellation) - broadcast to both players
    PERFORM realtime.broadcast_changes(
      'matchmaking',                                    -- topic - broadcast to matchmaking channel
      TG_OP,                                           -- event - UPDATE
      TG_OP,                                           -- operation - UPDATE
      TG_TABLE_NAME,                                   -- table - games
      TG_TABLE_SCHEMA,                                 -- schema - public
      NEW,                                             -- new record - updated game
      OLD                                              -- old record - previous game state
    );
  ELSIF TG_OP = 'DELETE' THEN
    -- Game deleted (e.g., decline) - broadcast to both players
    PERFORM realtime.broadcast_changes(
      'matchmaking',                                    -- topic - broadcast to matchmaking channel
      TG_OP,                                           -- event - DELETE
      TG_OP,                                           -- operation - DELETE
      TG_TABLE_NAME,                                   -- table - games
      TG_TABLE_SCHEMA,                                 -- schema - public
      NULL,                                            -- new record - no new record for DELETE
      OLD                                              -- old record - deleted game
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger to broadcast game changes
CREATE TRIGGER handle_games_broadcast_changes
  AFTER INSERT OR UPDATE OR DELETE
  ON public.games
  FOR EACH ROW
  EXECUTE FUNCTION public.games_broadcast_changes(); 