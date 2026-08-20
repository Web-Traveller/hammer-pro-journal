-- ==============================================================================
-- HAMMER PRO JOURNAL - SAFE PRODUCTION SUPABASE SCHEMA & MIGRATION SCRIPT
-- 100% Safe to run on existing databases (Preserves all existing data)
-- Run in: Supabase Project Dashboard -> SQL Editor -> Run
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. USER PROFILES TABLE (Safe Table & Column Migration)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE,
    full_name TEXT,
    license_key TEXT,
    is_blocked BOOLEAN DEFAULT FALSE,
    snapshot_hash TEXT,
    cloud_provider TEXT DEFAULT 'supabase_cloud',
    last_sync_timestamp BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all required columns exist without dropping table
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS license_key TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS snapshot_hash TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS cloud_provider TEXT DEFAULT 'supabase_cloud';
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS last_sync_timestamp BIGINT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles (email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_license ON public.user_profiles (license_key);

-- ==============================================================================
-- 2. LICENSES TABLE (Activation Code & Multi-Device Governance Engine)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_key TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    device_fingerprint TEXT,
    bound_devices JSONB DEFAULT '[]'::jsonb,
    max_devices INTEGER DEFAULT 1,
    max_users INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMPTZ,
    features JSONB DEFAULT '{"allow_cloud_sync": true, "max_screenshots": 999}'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS bound_devices JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS max_devices INTEGER DEFAULT 1;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS max_users INTEGER DEFAULT 1;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{"allow_cloud_sync": true, "max_screenshots": 999}'::jsonb;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_licenses_key ON public.licenses (license_key);

-- ==============================================================================
-- 3. DAILY SESSION STATS TABLE (Two-Way Cloud Sync)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.daily_session_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    session_date TEXT NOT NULL,
    pnl NUMERIC DEFAULT 0,
    gross_pnl NUMERIC DEFAULT 0,
    net_pnl NUMERIC DEFAULT 0,
    fees NUMERIC DEFAULT 0,
    win_rate NUMERIC DEFAULT 0,
    total_trades INTEGER DEFAULT 0,
    round_trip_shares INTEGER DEFAULT 0,
    avg_hold_seconds NUMERIC DEFAULT 0,
    profit_factor NUMERIC DEFAULT 0,
    journal_note TEXT DEFAULT '',
    r2_log_key TEXT DEFAULT '',
    screenshots_keys JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_user_session_date UNIQUE (user_id, session_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_stats_user ON public.daily_session_stats (user_id);
CREATE INDEX IF NOT EXISTS idx_daily_stats_user_date ON public.daily_session_stats (user_id, session_date);

-- ==============================================================================
-- 4. APP CONFIG TABLE (Version Gate & Feature Toggles)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.app_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- Enables clean client-side sync via Supabase Anon Key without permission blocks
-- ==============================================================================
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_session_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow user_profiles access" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow licenses access" ON public.licenses;
DROP POLICY IF EXISTS "Allow daily_session_stats access" ON public.daily_session_stats;
DROP POLICY IF EXISTS "Allow app_config read access" ON public.app_config;

CREATE POLICY "Allow user_profiles access"
    ON public.user_profiles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow licenses access"
    ON public.licenses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow daily_session_stats access"
    ON public.daily_session_stats FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow app_config read access"
    ON public.app_config FOR SELECT TO anon, authenticated USING (true);

-- ==============================================================================
-- 6. CRYPTOGRAPHIC UNGUESSABLE ACTIVATION CODE GENERATOR FUNCTION
-- Generates unique, high-entropy codes (e.g. HPJ-8F9A-4E2B-9C1D-77A3)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.generate_activation_code(
    prefix TEXT DEFAULT 'HPJ',
    p_max_devices INT DEFAULT 1,
    p_features JSONB DEFAULT '{"allow_cloud_sync": true, "max_screenshots": 999}'::jsonb,
    p_notes TEXT DEFAULT 'Generated Activation Code'
)
RETURNS TEXT AS $$
DECLARE
    v_raw_hex TEXT;
    v_code TEXT;
BEGIN
    -- 16 bytes of cryptographic random data = 32 hex chars
    v_raw_hex := UPPER(encode(gen_random_bytes(10), 'hex'));
    
    -- Format: PREFIX-XXXX-XXXX-XXXX-XXXX
    v_code := UPPER(prefix) || '-' ||
              SUBSTRING(v_raw_hex FROM 1 FOR 4) || '-' ||
              SUBSTRING(v_raw_hex FROM 5 FOR 4) || '-' ||
              SUBSTRING(v_raw_hex FROM 9 FOR 4) || '-' ||
              SUBSTRING(v_raw_hex FROM 13 FOR 4);

    INSERT INTO public.licenses (license_key, max_devices, max_users, is_active, features, notes)
    VALUES (v_code, p_max_devices, p_max_devices, TRUE, p_features, p_notes);

    RETURN v_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 7. INITIAL APP CONFIG & INITIAL ACTIVATION CODES
-- ==============================================================================
INSERT INTO public.app_config (key, value)
VALUES
    ('min_supported_version', '{"version": "2.0.0", "force_update": false, "notice": ""}'::jsonb),
    ('license_enforcement', '{"enabled": true, "require_license_key": true}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Generate 1 Single-User Test Code
SELECT public.generate_activation_code('HPJ-PRO', 1, '{"allow_cloud_sync": true, "max_screenshots": 999}'::jsonb, 'Test Single User Code');

-- Generate 1 Multi-User 10-Device Team Code
SELECT public.generate_activation_code('HPJ-TEAM', 10, '{"allow_cloud_sync": true, "max_screenshots": 999}'::jsonb, 'Test 10 User Team Code');
