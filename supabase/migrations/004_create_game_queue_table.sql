-- Create game_queue table for matchmaking
CREATE TABLE IF NOT EXISTS public.game_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.game_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies for game_queue table
-- Users can view their own queue entries
DROP POLICY IF EXISTS "Users can view own queue entries" ON public.game_queue;
CREATE POLICY "Users can view own queue entries" ON public.game_queue
    FOR SELECT USING (auth.uid() = user_id);

-- Matchmaking system can view all queue entries for processing
DROP POLICY IF EXISTS "Matchmaking can view all queue entries" ON public.game_queue;
CREATE POLICY "Matchmaking can view all queue entries" ON public.game_queue
    FOR SELECT USING (true);

-- Users can insert their own queue entries
DROP POLICY IF EXISTS "Users can insert own queue entries" ON public.game_queue;
CREATE POLICY "Users can insert own queue entries" ON public.game_queue
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own queue entries
DROP POLICY IF EXISTS "Users can delete own queue entries" ON public.game_queue;
CREATE POLICY "Users can delete own queue entries" ON public.game_queue
    FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_game_queue_user_id ON public.game_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_game_queue_created_at ON public.game_queue(created_at ASC);

-- Create unique constraint to prevent multiple queue entries per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_game_queue_unique_user ON public.game_queue(user_id);

-- Function to process matchmaking

DROP TRIGGER IF EXISTS trigger_process_matchmaking ON game_queue;
DROP FUNCTION IF EXISTS process_matchmaking;
CREATE OR REPLACE FUNCTION process_matchmaking()
RETURNS TRIGGER AS $$
DECLARE
    player1 RECORD;
    player2 RECORD;
    game_id UUID;
BEGIN
    -- Get all players in queue with their profiles
    FOR player1 IN 
        SELECT 
            q.user_id,
            q.created_at,
            u.username,
            u.rating
        FROM game_queue q
        JOIN users u ON q.user_id = u.id
        ORDER BY q.created_at ASC
    LOOP
        -- Look for a suitable opponent
        FOR player2 IN 
            SELECT 
                q.user_id,
                q.created_at,
                u.username,
                u.rating
            FROM game_queue q
            JOIN users u ON q.user_id = u.id
            WHERE q.user_id != player1.user_id
            ORDER BY q.created_at ASC
        LOOP
            -- Check if they're a good match (within 300 rating points)
            IF ABS(player1.rating - player2.rating) <= 300 THEN
                -- Create a game
                INSERT INTO games (player1_id, player2_id, status, current_player, created_at, updated_at)
                VALUES (player1.user_id, player2.user_id, 'waiting', player1.user_id, NOW(), NOW())
                RETURNING id INTO game_id;
                
                -- Remove both players from queue
                DELETE FROM game_queue WHERE user_id IN (player1.user_id, player2.user_id);
                
                -- Log the match creation
                RAISE NOTICE 'Match created: % vs % (Game ID: %)', player1.username, player2.username, game_id;
                
                -- Exit the loops since we found a match
                RETURN NEW;
            END IF;
        END LOOP;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to process matchmaking when queue changes
CREATE TRIGGER trigger_process_matchmaking
    AFTER INSERT ON game_queue
    FOR EACH ROW
    EXECUTE FUNCTION process_matchmaking(); 