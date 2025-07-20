-- Remove the remaining triggers that were identified in the previous migration
-- These triggers are likely causing the completion_type error

-- Drop the remaining triggers that we found
DROP TRIGGER IF EXISTS handle_games_broadcast_changes ON games;
DROP TRIGGER IF EXISTS trigger_broadcast_match_created ON games;
DROP TRIGGER IF EXISTS trigger_handle_game_acceptance ON games;
DROP TRIGGER IF EXISTS trigger_notify_match_created ON games;
DROP TRIGGER IF EXISTS trigger_update_achievement_stats ON games;
DROP TRIGGER IF EXISTS trigger_validate_game_status_update ON games;
DROP TRIGGER IF EXISTS update_games_updated_at ON games;

-- Drop the functions that these triggers depend on
DROP FUNCTION IF EXISTS handle_games_broadcast_changes() CASCADE;
DROP FUNCTION IF EXISTS broadcast_match_created() CASCADE;
DROP FUNCTION IF EXISTS handle_game_acceptance() CASCADE;
DROP FUNCTION IF EXISTS notify_match_created() CASCADE;
DROP FUNCTION IF EXISTS update_achievement_stats() CASCADE;
DROP FUNCTION IF EXISTS validate_game_status_update() CASCADE;
DROP FUNCTION IF EXISTS update_games_updated_at() CASCADE;

-- Now the games table should have no triggers that could interfere with cancel_game
-- Let's verify this by listing triggers again
DO $$
DECLARE
    trigger_record RECORD;
    trigger_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Remaining triggers on games table:';
    FOR trigger_record IN 
        SELECT trigger_name, event_manipulation, action_timing
        FROM information_schema.triggers 
        WHERE event_object_table = 'games' AND trigger_schema = 'public'
    LOOP
        RAISE NOTICE 'Trigger: % (% %)', trigger_record.trigger_name, trigger_record.action_timing, trigger_record.event_manipulation;
        trigger_count := trigger_count + 1;
    END LOOP;
    
    IF trigger_count = 0 THEN
        RAISE NOTICE 'No triggers remaining on games table - this is good!';
    ELSE
        RAISE NOTICE 'WARNING: % triggers still remain on games table', trigger_count;
    END IF;
END $$; 