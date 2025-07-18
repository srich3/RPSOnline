-- Create users table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    rating INTEGER DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
-- Users can read their own profile
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Users can insert their own profile (when they sign up)
CREATE POLICY "Users can insert own profile" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Anyone can read public user data (for leaderboards, etc.)
CREATE POLICY "Anyone can view public user data" ON public.users
    FOR SELECT USING (true);

-- Create index for username lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);

-- Create index for rating (for leaderboards)
CREATE INDEX IF NOT EXISTS idx_users_rating ON public.users(rating DESC); 