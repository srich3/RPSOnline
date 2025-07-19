-- Add tutorial_complete column to users table
ALTER TABLE users
ADD  COLUMN IF NOT EXISTS tutorial_complete boolean NOT NULL DEFAULT false; 