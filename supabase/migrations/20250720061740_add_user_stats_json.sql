-- Add user stats JSON field
-- This migration adds a single JSON field to store all user statistics and achievements

-- Add stats_json column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS stats_json JSONB DEFAULT '{
  "games_played": 0,
  "games_won": 0,
  "games_lost": 0,
  "total_attacks": 0,
  "successful_attacks": 0,
  "failed_attacks": 0,
  "total_defends": 0,
  "successful_defends": 0,
  "failed_defends": 0,
  "total_conquers": 0,
  "successful_conquers": 0,
  "failed_conquers": 0,
  "attacks_blocked": 0,
  "perfect_defenses": 0,
  "aggressive_wins": 0,
  "current_rating": 1000,
  "highest_rating": 1000,
  "win_streak": 0,
  "longest_win_streak": 0,
  "achievements": [],
  "game_history": []
}'::jsonb;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_users_stats_json ON users USING GIN (stats_json);

-- Function to update user stats (called by client at game end)
CREATE OR REPLACE FUNCTION update_user_stats(
  user_uuid UUID,
  new_stats JSONB
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE users 
  SET stats_json = new_stats
  WHERE id = user_uuid;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 