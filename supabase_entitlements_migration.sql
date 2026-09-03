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

-- 4. HARDENED TRIGGER: PREVENT CLIENT-SIDE PRIVILEGE ESCALATION
-- Even if an authenticated user attempts to update can_cloud_sync, daily_image_limit,
-- plan_tier, or is_blocked from DevTools / curl, this trigger guarantees that those fields
-- cannot be changed by regular authenticated clients, reverting them to their database values!
CREATE OR REPLACE FUNCTION public.protect_user_profile_entitlements()
RETURNS TRIGGER AS $$
BEGIN
  -- If not service_role (i.e. regular authenticated user from client), revert entitlement fields
  IF (auth.jwt() ->> 'role') != 'service_role' THEN
    NEW.can_cloud_sync := OLD.can_cloud_sync;
    NEW.daily_image_limit := OLD.daily_image_limit;
    NEW.is_blocked := OLD.is_blocked;
    NEW.plan_tier := OLD.plan_tier;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_user_profile_entitlements ON public.user_profiles;
CREATE TRIGGER trg_protect_user_profile_entitlements
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_user_profile_entitlements();

-- 5. Seed R2 Dynamic Configuration in app_config
-- Allows rotating or updating R2 storage credentials anytime without rebuilding client binaries!
INSERT INTO public.app_config (key, value, updated_at)
VALUES (
  'r2_config',
  jsonb_build_object(
    'accountId', '76cdb43cd04ce3235b092defe0eeaeac',
    'bucket', 'hammer-pro-journal',
    'accessKeyId', '46884316eff299e9e1fec432790e90f8',
    'secretAccessKey', '94b0fe9a0d1e4cbeea0c65722adfc9cea7bf2fae35a4547822d7697adf0e16b5'
  ),
  NOW()
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = NOW();

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
