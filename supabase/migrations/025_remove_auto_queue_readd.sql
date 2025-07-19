-- Remove automatic queue re-addition functionality
-- This allows users to manually control when they rejoin the queue after a declined match

-- Drop the function that automatically adds players back to queue
DROP FUNCTION IF EXISTS add_player_to_queue(UUID);

-- Note: Users will now need to manually rejoin the queue after declining a match
-- This gives them more control over their gaming experience 