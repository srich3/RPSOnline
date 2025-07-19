-- Migration: Add the missing trigger for games broadcast
-- The function exists but the trigger is missing

-- Create trigger to broadcast game changes
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
    
    RAISE NOTICE 'Trigger handle_games_broadcast_changes created successfully';
  ELSE
    RAISE NOTICE 'Trigger handle_games_broadcast_changes already exists';
  END IF;
END $$; 