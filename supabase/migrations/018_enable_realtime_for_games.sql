-- Enable Postgres Changes for the games table
-- This allows real-time subscriptions to work for INSERT/UPDATE/DELETE events

-- Add the games table to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE games;

-- Also add game_queue table for completeness
ALTER PUBLICATION supabase_realtime ADD TABLE game_queue; 