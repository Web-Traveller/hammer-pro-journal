-- =========================================================================
-- HAMMER PRO JOURNAL - CLEAN RESET SCRIPT (WIPE EVERYTHING)
-- WARNING: This drops all tables and wipes all test data from Supabase.
-- Copy and paste into Supabase SQL Editor and click "Run".
-- =========================================================================

-- 1. Drop Tables
DROP TABLE IF EXISTS public.daily_session_stats CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;
DROP TABLE IF EXISTS public.app_config CASCADE;

-- 2. Drop Helper Functions (if any exist)
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;

-- 3. Confirmation Output
SELECT 'DATABASE_CLEANED_SUCCESSFULLY' AS status;
