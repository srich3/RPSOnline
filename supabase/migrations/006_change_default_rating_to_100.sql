-- Change default rating from 1000 to 100
ALTER TABLE users ALTER COLUMN rating SET DEFAULT 100;

-- Update existing users who have the old default rating of 1000 to 100
UPDATE users SET rating = 100 WHERE rating = 1000; 