-- Add broadcast authorization policy for authenticated users
-- This allows users to receive broadcast messages from the database

CREATE POLICY "Authenticated users can receive broadcasts"
ON "realtime"."messages"
FOR SELECT
TO authenticated
USING ( true ); 