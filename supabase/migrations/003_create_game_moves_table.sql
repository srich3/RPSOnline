-- Create game_moves table
CREATE TABLE IF NOT EXISTS public.game_moves (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    game_id UUID REFERENCES public.games(id) ON DELETE CASCADE NOT NULL,
    player_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    turn_number INTEGER NOT NULL,
    action_type TEXT CHECK (action_type IN ('claim', 'attack', 'defend', 'conquer')) NOT NULL,
    target_square INTEGER CHECK (target_square >= 0 AND target_square <= 8) NOT NULL,
    points_spent INTEGER CHECK (points_spent >= 0) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.game_moves ENABLE ROW LEVEL SECURITY;

-- RLS Policies for game_moves table
-- Players can view moves for games they're participating in
DROP POLICY IF EXISTS "Players can view moves in their games" ON public.game_moves;
CREATE POLICY "Players can view moves in their games" ON public.game_moves
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.games 
            WHERE id = game_moves.game_id 
            AND (player1_id = auth.uid() OR player2_id = auth.uid())
        )
    );

-- Players can insert moves for games they're participating in
DROP POLICY IF EXISTS "Players can insert moves in their games" ON public.game_moves;
CREATE POLICY "Players can insert moves in their games" ON public.game_moves
    FOR INSERT WITH CHECK (
        player_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.games 
            WHERE id = game_moves.game_id 
            AND (player1_id = auth.uid() OR player2_id = auth.uid())
        )
    );

-- Players can update their own moves (for corrections)
DROP POLICY IF EXISTS "Players can update their own moves" ON public.game_moves;
CREATE POLICY "Players can update their own moves" ON public.game_moves
    FOR UPDATE USING (player_id = auth.uid());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_game_moves_game_id ON public.game_moves(game_id);
CREATE INDEX IF NOT EXISTS idx_game_moves_player_id ON public.game_moves(player_id);
CREATE INDEX IF NOT EXISTS idx_game_moves_turn_number ON public.game_moves(game_id, turn_number);
CREATE INDEX IF NOT EXISTS idx_game_moves_created_at ON public.game_moves(created_at DESC); 