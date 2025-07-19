-- Add DELETE policy for games table
-- Players can delete games they're participating in (for declining matches)

-- Players can delete games they're participating in
DROP POLICY IF EXISTS "Players can delete their games" ON public.games;
CREATE POLICY "Players can delete their games" ON public.games
    FOR DELETE USING (
        auth.uid() = player1_id OR 
        auth.uid() = player2_id
    ); 