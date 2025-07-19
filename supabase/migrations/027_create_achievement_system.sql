-- Create proper achievement system
-- Add achievement stats to users table for quick access
-- Create achievements table for tracking individual achievements

-- Add achievement stats columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS total_games_played INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS games_won INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS games_lost INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS games_forfeited INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS games_canceled INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS opponents_forfeited INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS opponents_canceled INTEGER DEFAULT 0;

-- Create achievements table
CREATE TABLE IF NOT EXISTS achievements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    icon VARCHAR(50) DEFAULT 'trophy',
    category VARCHAR(50) DEFAULT 'general',
    requirement_type VARCHAR(50) NOT NULL, -- 'games_won', 'opponents_forfeited', etc.
    requirement_value INTEGER NOT NULL,
    reward_type VARCHAR(50) DEFAULT NULL, -- 'title', 'badge', 'cosmetic', etc.
    reward_value VARCHAR(100) DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_achievements table to track which users have earned which achievements
CREATE TABLE IF NOT EXISTS user_achievements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE NOT NULL,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, achievement_id)
);

-- Enable RLS on new tables
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for achievements table
CREATE POLICY "Anyone can view achievements" ON achievements
    FOR SELECT USING (true);

CREATE POLICY "Only admins can modify achievements" ON achievements
    FOR ALL USING (auth.uid() IN (
        SELECT id FROM users WHERE username = 'admin' -- Adjust based on your admin system
    ));

-- RLS Policies for user_achievements table
CREATE POLICY "Users can view their own achievements" ON user_achievements
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert user achievements" ON user_achievements
    FOR INSERT WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id ON user_achievements(achievement_id);
CREATE INDEX IF NOT EXISTS idx_achievements_requirement_type ON achievements(requirement_type);

-- Insert default achievements
INSERT INTO achievements (name, description, icon, category, requirement_type, requirement_value, reward_type, reward_value) VALUES
('Intimidating Presence', 'Cause 100 players to cancel a match before it started', 'skull', 'intimidation', 'opponents_canceled', 100, 'title', 'The Intimidating'),
('Overwhelming', 'Cause 100 players to forfeit the match', 'fire', 'domination', 'opponents_forfeited', 100, 'title', 'The Overwhelming'),
('Quick Retreat', 'Forfeit over 100 matches', 'flag', 'survival', 'games_forfeited', 100, 'title', 'The Quick'),
('Veteran Player', 'Play 1000 total games', 'shield', 'dedication', 'total_games_played', 1000, 'badge', 'veteran'),
('Champion', 'Win 500 games', 'crown', 'victory', 'games_won', 500, 'title', 'The Champion'),
('Unstoppable', 'Win 1000 games', 'star', 'victory', 'games_won', 1000, 'title', 'The Unstoppable'),
('Sportsman', 'Never forfeit a game (minimum 50 games played)', 'handshake', 'honor', 'games_forfeited', 0, 'badge', 'sportsman')
ON CONFLICT (name) DO NOTHING;

-- Create function to update user stats when game completes
CREATE OR REPLACE FUNCTION update_user_achievement_stats()
RETURNS TRIGGER AS $$
DECLARE
    player1_stats RECORD;
    player2_stats RECORD;
    achievement RECORD;
    user_achievement_exists BOOLEAN;
BEGIN
    -- Only process when game is completed
    IF NEW.completion_type IS NULL OR OLD.completion_type IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Get current stats for both players
    SELECT total_games_played, games_won, games_lost, games_forfeited, games_canceled, opponents_forfeited, opponents_canceled
    INTO player1_stats
    FROM users WHERE id = NEW.player1_id;

    SELECT total_games_played, games_won, games_lost, games_forfeited, games_canceled, opponents_forfeited, opponents_canceled
    INTO player2_stats
    FROM users WHERE id = NEW.player2_id;

    -- Update player1 stats
    UPDATE users SET
        total_games_played = total_games_played + 1,
        games_won = CASE 
            WHEN NEW.winner_id = NEW.player1_id THEN games_won + 1
            ELSE games_won
        END,
        games_lost = CASE 
            WHEN NEW.winner_id = NEW.player2_id THEN games_lost + 1
            ELSE games_lost
        END,
        games_forfeited = CASE 
            WHEN NEW.forfeited_by = NEW.player1_id THEN games_forfeited + 1
            ELSE games_forfeited
        END,
        games_canceled = CASE 
            WHEN NEW.canceled_by = NEW.player1_id THEN games_canceled + 1
            ELSE games_canceled
        END,
        opponents_forfeited = CASE 
            WHEN NEW.forfeited_by = NEW.player2_id THEN opponents_forfeited + 1
            ELSE opponents_forfeited
        END,
        opponents_canceled = CASE 
            WHEN NEW.canceled_by = NEW.player2_id THEN opponents_canceled + 1
            ELSE opponents_canceled
        END
    WHERE id = NEW.player1_id;

    -- Update player2 stats
    UPDATE users SET
        total_games_played = total_games_played + 1,
        games_won = CASE 
            WHEN NEW.winner_id = NEW.player2_id THEN games_won + 1
            ELSE games_won
        END,
        games_lost = CASE 
            WHEN NEW.winner_id = NEW.player1_id THEN games_lost + 1
            ELSE games_lost
        END,
        games_forfeited = CASE 
            WHEN NEW.forfeited_by = NEW.player2_id THEN games_forfeited + 1
            ELSE games_forfeited
        END,
        games_canceled = CASE 
            WHEN NEW.canceled_by = NEW.player2_id THEN games_canceled + 1
            ELSE games_canceled
        END,
        opponents_forfeited = CASE 
            WHEN NEW.forfeited_by = NEW.player1_id THEN opponents_forfeited + 1
            ELSE opponents_forfeited
        END,
        opponents_canceled = CASE 
            WHEN NEW.canceled_by = NEW.player1_id THEN opponents_canceled + 1
            ELSE opponents_canceled
        END
    WHERE id = NEW.player2_id;

    -- Check for new achievements for both players
    FOR achievement IN 
        SELECT * FROM achievements 
        WHERE requirement_type IN ('total_games_played', 'games_won', 'games_lost', 'games_forfeited', 'games_canceled', 'opponents_forfeited', 'opponents_canceled')
    LOOP
        -- Check player1 achievements
        SELECT EXISTS(
            SELECT 1 FROM user_achievements 
            WHERE user_id = NEW.player1_id AND achievement_id = achievement.id
        ) INTO user_achievement_exists;

        IF NOT user_achievement_exists THEN
            -- Check if player1 meets the requirement
            IF (
                (achievement.requirement_type = 'total_games_played' AND player1_stats.total_games_played + 1 >= achievement.requirement_value) OR
                (achievement.requirement_type = 'games_won' AND player1_stats.games_won + CASE WHEN NEW.winner_id = NEW.player1_id THEN 1 ELSE 0 END >= achievement.requirement_value) OR
                (achievement.requirement_type = 'games_lost' AND player1_stats.games_lost + CASE WHEN NEW.winner_id = NEW.player2_id THEN 1 ELSE 0 END >= achievement.requirement_value) OR
                (achievement.requirement_type = 'games_forfeited' AND player1_stats.games_forfeited + CASE WHEN NEW.forfeited_by = NEW.player1_id THEN 1 ELSE 0 END >= achievement.requirement_value) OR
                (achievement.requirement_type = 'games_canceled' AND player1_stats.games_canceled + CASE WHEN NEW.canceled_by = NEW.player1_id THEN 1 ELSE 0 END >= achievement.requirement_value) OR
                (achievement.requirement_type = 'opponents_forfeited' AND player1_stats.opponents_forfeited + CASE WHEN NEW.forfeited_by = NEW.player2_id THEN 1 ELSE 0 END >= achievement.requirement_value) OR
                (achievement.requirement_type = 'opponents_canceled' AND player1_stats.opponents_canceled + CASE WHEN NEW.canceled_by = NEW.player2_id THEN 1 ELSE 0 END >= achievement.requirement_value)
            ) THEN
                INSERT INTO user_achievements (user_id, achievement_id) VALUES (NEW.player1_id, achievement.id);
                RAISE NOTICE 'Achievement % earned by player %', achievement.name, NEW.player1_id;
            END IF;
        END IF;

        -- Check player2 achievements
        SELECT EXISTS(
            SELECT 1 FROM user_achievements 
            WHERE user_id = NEW.player2_id AND achievement_id = achievement.id
        ) INTO user_achievement_exists;

        IF NOT user_achievement_exists THEN
            -- Check if player2 meets the requirement
            IF (
                (achievement.requirement_type = 'total_games_played' AND player2_stats.total_games_played + 1 >= achievement.requirement_value) OR
                (achievement.requirement_type = 'games_won' AND player2_stats.games_won + CASE WHEN NEW.winner_id = NEW.player2_id THEN 1 ELSE 0 END >= achievement.requirement_value) OR
                (achievement.requirement_type = 'games_lost' AND player2_stats.games_lost + CASE WHEN NEW.winner_id = NEW.player1_id THEN 1 ELSE 0 END >= achievement.requirement_value) OR
                (achievement.requirement_type = 'games_forfeited' AND player2_stats.games_forfeited + CASE WHEN NEW.forfeited_by = NEW.player2_id THEN 1 ELSE 0 END >= achievement.requirement_value) OR
                (achievement.requirement_type = 'games_canceled' AND player2_stats.games_canceled + CASE WHEN NEW.canceled_by = NEW.player2_id THEN 1 ELSE 0 END >= achievement.requirement_value) OR
                (achievement.requirement_type = 'opponents_forfeited' AND player2_stats.opponents_forfeited + CASE WHEN NEW.forfeited_by = NEW.player1_id THEN 1 ELSE 0 END >= achievement.requirement_value) OR
                (achievement.requirement_type = 'opponents_canceled' AND player2_stats.opponents_canceled + CASE WHEN NEW.canceled_by = NEW.player1_id THEN 1 ELSE 0 END >= achievement.requirement_value)
            ) THEN
                INSERT INTO user_achievements (user_id, achievement_id) VALUES (NEW.player2_id, achievement.id);
                RAISE NOTICE 'Achievement % earned by player %', achievement.name, NEW.player2_id;
            END IF;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update stats when game completes
DROP TRIGGER IF EXISTS trigger_update_achievement_stats ON games;
CREATE TRIGGER trigger_update_achievement_stats
    AFTER UPDATE ON games
    FOR EACH ROW
    EXECUTE FUNCTION update_user_achievement_stats();

-- Update existing users with current stats
UPDATE users SET
    total_games_played = (
        SELECT COUNT(*) FROM games 
        WHERE (player1_id = users.id OR player2_id = users.id) 
        AND completion_type IS NOT NULL
    ),
    games_won = (
        SELECT COUNT(*) FROM games 
        WHERE winner_id = users.id
    ),
    games_lost = (
        SELECT COUNT(*) FROM games 
        WHERE (player1_id = users.id OR player2_id = users.id) 
        AND winner_id IS NOT NULL 
        AND winner_id != users.id
    ),
    games_forfeited = (
        SELECT COUNT(*) FROM games 
        WHERE forfeited_by = users.id
    ),
    games_canceled = (
        SELECT COUNT(*) FROM games 
        WHERE canceled_by = users.id
    ),
    opponents_forfeited = (
        SELECT COUNT(*) FROM games 
        WHERE (player1_id = users.id OR player2_id = users.id) 
        AND forfeited_by IS NOT NULL 
        AND forfeited_by != users.id
    ),
    opponents_canceled = (
        SELECT COUNT(*) FROM games 
        WHERE (player1_id = users.id OR player2_id = users.id) 
        AND canceled_by IS NOT NULL 
        AND canceled_by != users.id
    );

-- Grant permissions
GRANT SELECT ON achievements TO authenticated;
GRANT SELECT ON user_achievements TO authenticated;
GRANT INSERT ON user_achievements TO authenticated; 