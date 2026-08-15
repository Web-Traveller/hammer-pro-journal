-- =========================================================================
-- HAMMER PRO JOURNAL - FRESH START PRODUCTION SCHEMA
-- Copy and paste this script into your Supabase SQL Editor and click "Run".
-- =========================================================================

-- 1. App Configuration Table (Dynamic Updater & Storage Endpoints)
CREATE TABLE IF NOT EXISTS public.app_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default configuration
INSERT INTO public.app_config (key, value, description)
VALUES 
    ('updater_config', '{"updater_url": "https://qvzttflsjcgndjusvykq.supabase.co/storage/v1/object/public/app-updates/latest.json", "min_version": "1.0.0", "latest_version": "1.0.3"}'::jsonb, 'Active Tauri updater URL and version requirements'),
    ('storage_config', '{"provider": "cloudflare_r2", "r2_endpoint": "https://76cdb43cd04ce3235b092defe0eeaeac.r2.cloudflarestorage.com/hammer-pro-journal", "bucket": "hammer-pro-journal"}'::jsonb, 'Cloud storage backend endpoints')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 2. Lightweight Daily Session Metadata Table (~1 KB per day)
CREATE TABLE IF NOT EXISTS public.daily_session_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_date TEXT NOT NULL,
    pnl NUMERIC(12, 2) DEFAULT 0,
    gross_pnl NUMERIC(12, 2) DEFAULT 0,
    net_pnl NUMERIC(12, 2) DEFAULT 0,
    fees NUMERIC(12, 2) DEFAULT 0,
    win_rate NUMERIC(6, 2) DEFAULT 0,
    total_trades INTEGER DEFAULT 0,
    round_trip_shares INTEGER DEFAULT 0,
    avg_hold_seconds NUMERIC(8, 2) DEFAULT 0,
    profit_factor NUMERIC(8, 2) DEFAULT 0,
    journal_note TEXT DEFAULT '',
    r2_log_key TEXT DEFAULT '',
    screenshots_keys JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_session UNIQUE (user_id, session_date)
);

-- 3. User Profiles Table
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    plan_tier TEXT DEFAULT 'free',
    avatar_url TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_session_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 5. Security Policies

-- A. App Config: Anyone can READ (Public), only Service Role / Admin can WRITE
DROP POLICY IF EXISTS "Public read app_config" ON public.app_config;
CREATE POLICY "Public read app_config"
ON public.app_config
FOR SELECT
USING (true);

-- B. Daily Session Stats: Users can ONLY access their own data
DROP POLICY IF EXISTS "Users can manage own session stats" ON public.daily_session_stats;
CREATE POLICY "Users can manage own session stats"
ON public.daily_session_stats
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- C. User Profiles: Users can ONLY access their own profile
DROP POLICY IF EXISTS "Users can manage own profile" ON public.user_profiles;
CREATE POLICY "Users can manage own profile"
ON public.user_profiles
FOR ALL
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 6. Performance Indices
CREATE INDEX IF NOT EXISTS idx_session_user_date ON public.daily_session_stats(user_id, session_date DESC);
