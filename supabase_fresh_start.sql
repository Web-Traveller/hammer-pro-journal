-- =========================================================================
-- HAMMER PRO JOURNAL - PRODUCTION DATABASE SCHEMA (v2.0.0)
-- Includes:
-- 1. App Configuration (7-Day Hard Expiry Gate, Dynamic Updater & Storage)
-- 2. Cloud Licensing Engine & Instant Remote Device Lock
-- 3. Daily Session Metadata Table
-- 4. User Profiles Table (With SHA-256 Checksum Fingerprint Gating)
-- =========================================================================

-- 1. App Configuration Table (Dynamic Updater, Version Gates & Storage Endpoints)
CREATE TABLE IF NOT EXISTS public.app_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed production configuration (v2.0.0 + 7-Day Hard Expiry Gate + Licensing Policy)
INSERT INTO public.app_config (key, value, description)
VALUES 
    ('updater_config', '{"updater_url": "https://qvzttflsjcgndjusvykq.supabase.co/storage/v1/object/public/app-updates/latest.json", "min_version": "2.0.0", "latest_version": "2.0.0", "grace_period_days": 7, "download_url": "https://github.com/Web-Traveller/hammer-pro-journal/releases"}'::jsonb, 'Active version requirements and 7-day hard expiry rules'),
    ('storage_config', '{"provider": "cloudflare_r2", "r2_endpoint": "https://76cdb43cd04ce3235b092defe0eeaeac.r2.cloudflarestorage.com/hammer-pro-journal", "bucket": "hammer-pro-journal"}'::jsonb, 'Cloud storage backend endpoints'),
    ('license_enforcement', '{"enabled": false, "require_license_key": false}'::jsonb, 'Master switch to globally toggle license key verification on or off')
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

-- 3. User Profiles Table (With SHA-256 Checksum Fingerprint Gating & Remote Device Lock)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    plan_tier TEXT DEFAULT 'pro',
    avatar_url TEXT DEFAULT '',
    snapshot_hash TEXT DEFAULT '',
    license_key TEXT DEFAULT '',
    is_blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Licenses Table (Cryptographic Cloud Licensing & Device Binding)
CREATE TABLE IF NOT EXISTS public.licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_key TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    device_fingerprint TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT TRUE,
    tier TEXT DEFAULT 'pro',
    expires_at TIMESTAMPTZ,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed a master sample license key
INSERT INTO public.licenses (license_key, is_active, tier, notes)
VALUES 
    ('HAMMER-PRO-MASTER-2026-VIP', true, 'pro', 'Master Administrator & Founder License')
ON CONFLICT (license_key) DO NOTHING;

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_session_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

-- 6. Security Policies

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

-- D. Licenses: Authenticated users can read license info to verify activation
DROP POLICY IF EXISTS "Public read licenses" ON public.licenses;
CREATE POLICY "Public read licenses"
ON public.licenses
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Users can update own license device" ON public.licenses;
CREATE POLICY "Users can update own license device"
ON public.licenses
FOR UPDATE
USING (auth.uid() = user_id OR user_id IS NULL)
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- 7. Performance Indices
CREATE INDEX IF NOT EXISTS idx_session_user_date ON public.daily_session_stats(user_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_licenses_key ON public.licenses(license_key);
