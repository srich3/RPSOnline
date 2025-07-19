-- Enable Realtime for Games Table (if not already enabled)
-- Add the games table to the supabase_realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'games'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE games;
  END IF;
END $$;

-- Also add game_queue table for completeness (if not already enabled)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'game_queue'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE game_queue;
  END IF;
END $$;

-- Add broadcast authorization policy for authenticated users (if not already exists)
-- This allows users to receive broadcast messages from the database
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'realtime' 
    AND tablename = 'messages' 
    AND policyname = 'Authenticated users can receive broadcasts'
  ) THEN
    CREATE POLICY "Authenticated users can receive broadcasts"
    ON "realtime"."messages"
    FOR SELECT
    TO authenticated
    USING ( true );
  END IF;
END $$;

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

-- Create trigger to broadcast game changes (if not already exists)
-- This trigger will fire whenever a game is created, updated, or deleted
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'handle_games_broadcast_changes'
  ) THEN
    CREATE TRIGGER handle_games_broadcast_changes
      AFTER INSERT OR UPDATE OR DELETE
      ON public.games
      FOR EACH ROW
      EXECUTE FUNCTION public.games_broadcast_changes();
  END IF;
END $$; 