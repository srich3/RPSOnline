-- Create games table
CREATE TABLE IF NOT EXISTS public.games (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    player1_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    player2_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    status TEXT CHECK (status IN ('waiting', 'active', 'finished')) DEFAULT 'waiting',
    winner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    game_state JSONB DEFAULT '{}',
    turn_number INTEGER DEFAULT 1,
    current_player UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

-- RLS Policies for games table
-- Players can view games they're participating in
DROP POLICY IF EXISTS "Players can view their games" ON public.games;
CREATE POLICY "Players can view their games" ON public.games
    FOR SELECT USING (
        auth.uid() = player1_id OR 
        auth.uid() = player2_id OR 
        status = 'waiting'
    );

-- Players can update games they're participating in
DROP POLICY IF EXISTS "Players can update their games" ON public.games;
CREATE POLICY "Players can update their games" ON public.games
    FOR UPDATE USING (
        auth.uid() = player1_id OR 
        auth.uid() = player2_id
    );

-- Anyone can create a game (for matchmaking)
DROP POLICY IF EXISTS "Anyone can create games" ON public.games;
CREATE POLICY "Anyone can create games" ON public.games
    FOR INSERT WITH CHECK (auth.uid() = player1_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_games_player1_id ON public.games(player1_id);
CREATE INDEX IF NOT EXISTS idx_games_player2_id ON public.games(player2_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON public.games(status);
CREATE INDEX IF NOT EXISTS idx_games_created_at ON public.games(created_at DESC);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER  update_games_updated_at 
    BEFORE UPDATE ON public.games 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column(); 