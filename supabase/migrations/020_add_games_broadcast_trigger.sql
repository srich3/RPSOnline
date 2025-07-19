-- Create broadcast trigger function for games table
-- This will broadcast match events to both players when games are created

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
    -- Game updated (e.g., acceptance) - broadcast to both players
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
  
  RETURN NULL;
END;
$$; 