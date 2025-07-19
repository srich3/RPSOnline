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
CREATE POLICY "Users can view own queue entries" ON public.game_queue
    FOR SELECT USING (auth.uid() = user_id);

-- Matchmaking system can view all queue entries for processing
CREATE POLICY "Matchmaking can view all queue entries" ON public.game_queue
    FOR SELECT USING (true);

-- Users can insert their own queue entries
CREATE POLICY "Users can insert own queue entries" ON public.game_queue
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own queue entries
CREATE POLICY "Users can delete own queue entries" ON public.game_queue
    FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_game_queue_user_id ON public.game_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_game_queue_created_at ON public.game_queue(created_at ASC);

-- Create unique constraint to prevent multiple queue entries per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_game_queue_unique_user ON public.game_queue(user_id); 