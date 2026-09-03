-- ==============================================================================
-- HAMMER PRO JOURNAL - USER ENTITLEMENTS & ROW-LEVEL SECURITY MIGRATION
-- Run in: Supabase Project Dashboard -> SQL Editor -> Run
-- ==============================================================================

-- 1. Add Entitlement & Governance Columns to user_profiles table
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS can_cloud_sync BOOLEAN DEFAULT FALSE;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS daily_image_limit INTEGER DEFAULT 0;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS plan_tier TEXT DEFAULT 'free';

-- Ensure all existing users are initialized with safe defaults (logs only, no images in cloud by default)
UPDATE public.user_profiles
SET 
  can_cloud_sync = COALESCE(can_cloud_sync, FALSE),
  daily_image_limit = COALESCE(daily_image_limit, 0),
  is_blocked = COALESCE(is_blocked, FALSE),
  plan_tier = COALESCE(plan_tier, 'free')
WHERE can_cloud_sync IS NULL OR daily_image_limit IS NULL OR is_blocked IS NULL OR plan_tier IS NULL;

-- 2. Secure Indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_blocked ON public.user_profiles (is_blocked);
CREATE INDEX IF NOT EXISTS idx_user_profiles_cloud_sync ON public.user_profiles (can_cloud_sync);

-- 3. Hardened Row Level Security (RLS) Policies
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_session_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Clean up old open policies
DROP POLICY IF EXISTS "Allow user_profiles access" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own basic profile" ON public.user_profiles;

-- USER PROFILES POLICIES:
-- Users can read their own profile
CREATE POLICY "Users can read own profile"
    ON public.user_profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

-- Users can insert their initial profile upon registration
CREATE POLICY "Users can insert own profile"
    ON public.user_profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- Users can only update their display name and avatar (cannot escalate their own can_cloud_sync or limits!)
CREATE POLICY "Users can update own basic profile"
    ON public.user_profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- DAILY SESSION STATS POLICIES:
-- Users can only read and write their own daily session stats
DROP POLICY IF EXISTS "Allow daily_session_stats access" ON public.daily_session_stats;
DROP POLICY IF EXISTS "Users can manage own session stats" ON public.daily_session_stats;

CREATE POLICY "Users can manage own session stats"
    ON public.daily_session_stats FOR ALL
    TO authenticated
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

-- APP CONFIG POLICIES:
-- Users can read app configs (such as version requirements and broadcast announcements)
DROP POLICY IF EXISTS "Allow app_config read access" ON public.app_config;
CREATE POLICY "Allow app_config read access"
    ON public.app_config FOR SELECT
    TO authenticated, anon
    USING (true);

-- ==============================================================================
-- ADMIN INSTRUCTIONS:
-- To enable Cloud Sync for a specific user:
--   UPDATE public.user_profiles SET can_cloud_sync = TRUE WHERE email = 'user@example.com';
--
-- To allow 1 image per day/session for a specific user:
--   UPDATE public.user_profiles SET daily_image_limit = 1 WHERE email = 'user@example.com';
--
-- To allow unlimited images for a pro user:
--   UPDATE public.user_profiles SET can_cloud_sync = TRUE, daily_image_limit = 999, plan_tier = 'pro' WHERE email = 'user@example.com';
--
-- To suspend/block an abusive user immediately:
--   UPDATE public.user_profiles SET is_blocked = TRUE WHERE email = 'user@example.com';
-- ==============================================================================
