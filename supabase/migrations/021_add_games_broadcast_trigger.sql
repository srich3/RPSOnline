-- Create trigger to broadcast game changes
-- This trigger will fire whenever a game is created, updated, or deleted

CREATE TRIGGER handle_games_broadcast_changes
  AFTER INSERT OR UPDATE OR DELETE
  ON public.games
  FOR EACH ROW
  EXECUTE FUNCTION public.games_broadcast_changes(); 