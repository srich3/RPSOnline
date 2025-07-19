-- Add queue management functions that can bypass RLS
-- Create function to add player back to queue after decline

CREATE OR REPLACE FUNCTION add_player_to_queue(player_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Temporarily disable RLS for this function
    SET LOCAL row_security = off;
    
    -- Insert the player into the queue
    INSERT INTO game_queue (user_id) VALUES (player_id);
    
    -- Re-enable RLS
    SET LOCAL row_security = on;
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        -- Re-enable RLS in case of error
        SET LOCAL row_security = on;
        RAISE NOTICE 'Error adding player to queue: %', SQLERRM;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION add_player_to_queue(UUID) TO authenticated; 