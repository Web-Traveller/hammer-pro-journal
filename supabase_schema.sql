-- =========================================================================
-- HAMMER PRO JOURNAL - LIGHTWEIGHT DATABASE SCHEMA
-- Only stores lightweight statistical index (~1 KB per day)
-- Raw logs and images are stored in Cloudflare R2 / Storage.
-- =========================================================================

-- 1. Create Lightweight Daily Session Index Table
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

-- 2. Create User Profiles Table
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    plan_tier TEXT DEFAULT 'free',
    avatar_url TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.daily_session_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 4. Security Policies: Each user ONLY accesses their own session index
DROP POLICY IF EXISTS "Users can manage own session stats" ON public.daily_session_stats;
CREATE POLICY "Users can manage own session stats"
ON public.daily_session_stats
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own profile" ON public.user_profiles;
CREATE POLICY "Users can manage own profile"
ON public.user_profiles
FOR ALL
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 5. Performance Index
CREATE INDEX IF NOT EXISTS idx_session_user_date ON public.daily_session_stats(user_id, session_date DESC);
