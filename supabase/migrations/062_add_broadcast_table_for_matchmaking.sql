-- Add broadcast table for matchmaking events
-- This will allow the frontend to listen to real-time matchmaking updates

-- Create a broadcast table for matchmaking events
CREATE TABLE IF NOT EXISTS matchmaking_broadcasts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type TEXT NOT NULL,
    event_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE matchmaking_broadcasts ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read broadcasts
CREATE POLICY "Allow all users to read matchmaking broadcasts" ON matchmaking_broadcasts
    FOR SELECT USING (auth.role() = 'authenticated');

-- Allow the matchmaking function to insert broadcasts
CREATE POLICY "Allow matchmaking function to insert broadcasts" ON matchmaking_broadcasts
    FOR INSERT WITH CHECK (true);

-- Enable real-time for the broadcast table
ALTER PUBLICATION supabase_realtime ADD TABLE matchmaking_broadcasts;

-- Update the matchmaking function to use the broadcast table
DROP TRIGGER IF EXISTS trigger_process_matchmaking ON game_queue;
DROP FUNCTION IF EXISTS process_matchmaking();

CREATE OR REPLACE FUNCTION process_matchmaking()
RETURNS TRIGGER AS $$
DECLARE
    compatible_player RECORD;
    game_id UUID;
BEGIN
    -- Log that the trigger fired
    RAISE NOTICE '🎯 MATCHMAKING TRIGGER FIRED for user: % (rating: %)', NEW.user_id, NEW.rating;
    
    -- Broadcast that a player joined the queue
    INSERT INTO matchmaking_broadcasts (event_type, event_data)
    VALUES (
        'player_joined_queue',
        jsonb_build_object(
            'user_id', NEW.user_id,
            'rating', NEW.rating,
            'timestamp', NOW()
        )
    );
    
    RAISE NOTICE '📡 Broadcasted: player_joined_queue for user: %', NEW.user_id;
    
    -- Temporarily disable RLS for this function
    SET LOCAL row_security = off;
    
    -- Look for a compatible player (not the same player, within 300 rating points)
    SELECT 
        q.user_id,
        q.rating,
        q.created_at
    INTO compatible_player
    FROM game_queue q
    WHERE q.user_id != NEW.user_id  -- Not the same player
    AND ABS(q.rating - NEW.rating) <= 300  -- Within 300 rating points
    AND NOT EXISTS (  -- Not already in an active game
        SELECT 1 FROM games g
        WHERE (g.player1_id = q.user_id OR g.player2_id = q.user_id)
        AND g.status IN ('waiting', 'active')
    )
    ORDER BY q.created_at ASC  -- Oldest first
    LIMIT 1;  -- Just get the first compatible player
    
    -- If we found a compatible player, create a game
    IF compatible_player.user_id IS NOT NULL THEN
        RAISE NOTICE '🎯 Found compatible player: % (rating: %) vs % (rating: %)', 
            NEW.user_id, NEW.rating, compatible_player.user_id, compatible_player.rating;
        
        -- Broadcast that a match was found
        INSERT INTO matchmaking_broadcasts (event_type, event_data)
        VALUES (
            'match_found',
            jsonb_build_object(
                'player1_id', NEW.user_id,
                'player1_rating', NEW.rating,
                'player2_id', compatible_player.user_id,
                'player2_rating', compatible_player.rating,
                'timestamp', NOW()
            )
        );
        
        RAISE NOTICE '📡 Broadcasted: match_found between % and %', NEW.user_id, compatible_player.user_id;
        
        -- Create the game
        BEGIN
            INSERT INTO games (player1_id, player2_id, status, created_at, updated_at)
            VALUES (NEW.user_id, compatible_player.user_id, 'waiting', NOW(), NOW())
            RETURNING id INTO game_id;
            
            RAISE NOTICE '🎮 Game created successfully: %', game_id;
            
            -- Broadcast that a game was created
            INSERT INTO matchmaking_broadcasts (event_type, event_data)
            VALUES (
                'game_created',
                jsonb_build_object(
                    'game_id', game_id,
                    'player1_id', NEW.user_id,
                    'player2_id', compatible_player.user_id,
                    'status', 'waiting',
                    'timestamp', NOW()
                )
            );
            
            RAISE NOTICE '📡 Broadcasted: game_created with ID: %', game_id;
            
            -- Remove both players from queue
            DELETE FROM game_queue 
            WHERE user_id IN (NEW.user_id, compatible_player.user_id);
            
            RAISE NOTICE '✅ Players removed from queue: % and %', NEW.user_id, compatible_player.user_id;
            
            -- Broadcast that players were removed from queue
            INSERT INTO matchmaking_broadcasts (event_type, event_data)
            VALUES (
                'players_removed_from_queue',
                jsonb_build_object(
                    'player1_id', NEW.user_id,
                    'player2_id', compatible_player.user_id,
                    'timestamp', NOW()
                )
            );
            
            RAISE NOTICE '📡 Broadcasted: players_removed_from_queue for % and %', NEW.user_id, compatible_player.user_id;
            
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE '❌ Failed to create game: %', SQLERRM;
                
                -- Broadcast the error
                INSERT INTO matchmaking_broadcasts (event_type, event_data)
                VALUES (
                    'matchmaking_error',
                    jsonb_build_object(
                        'error', SQLERRM,
                        'player1_id', NEW.user_id,
                        'player2_id', compatible_player.user_id,
                        'timestamp', NOW()
                    )
                );
        END;
    ELSE
        RAISE NOTICE '⏳ No compatible player found for % (rating: %), waiting...', NEW.user_id, NEW.rating;
        
        -- Broadcast that no match was found
        INSERT INTO matchmaking_broadcasts (event_type, event_data)
        VALUES (
            'no_match_found',
            jsonb_build_object(
                'user_id', NEW.user_id,
                'rating', NEW.rating,
                'timestamp', NOW()
            )
        );
        
        RAISE NOTICE '📡 Broadcasted: no_match_found for user: %', NEW.user_id;
    END IF;
    
    -- Re-enable RLS
    SET LOCAL row_security = on;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
CREATE TRIGGER trigger_process_matchmaking
    AFTER INSERT ON game_queue
    FOR EACH ROW
    EXECUTE FUNCTION process_matchmaking(); 