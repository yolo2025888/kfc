-- 1. Create Sequence for Short ID (starting from 10000)
CREATE SEQUENCE IF NOT EXISTS user_short_id_seq START 10000;

-- 2. Add columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS short_id TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS province TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wechat_id TEXT;

-- Index for faster lookup by short_id
CREATE INDEX IF NOT EXISTS idx_profiles_short_id ON public.profiles(short_id);

-- 3. Create user_platform_accounts table
CREATE TABLE IF NOT EXISTS public.user_platform_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  account_id TEXT NOT NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Add a constraint to ensure a user can't add the same account_id for the same platform twice?
  -- Actually, let's allow it for now as "soft logic", but usually unique(user_id, platform, account_id) is good.
  -- But maybe they have multiple accounts with same ID? unlikely. Let's stick to unique constraint.
  UNIQUE(user_id, platform, account_id)
);

-- Enable RLS
ALTER TABLE public.user_platform_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can see their own accounts
CREATE POLICY "Users can view own platform accounts" 
ON public.user_platform_accounts FOR SELECT 
USING (auth.uid() = user_id);

-- Users can insert their own accounts (if we ever allow manual add from settings)
CREATE POLICY "Users can insert own platform accounts" 
ON public.user_platform_accounts FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own accounts
CREATE POLICY "Users can delete own platform accounts" 
ON public.user_platform_accounts FOR DELETE 
USING (auth.uid() = user_id);

-- Admins/Auditors can view all
CREATE POLICY "Staff can view all platform accounts" 
ON public.user_platform_accounts FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('admin', 'super_admin', 'auditor')
  )
);

-- 4. RPC to get next short ID
CREATE OR REPLACE FUNCTION get_next_short_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER -- Run as owner to access sequence if needed, though public usually can
AS $$
DECLARE
  next_val BIGINT;
BEGIN
  SELECT nextval('user_short_id_seq') INTO next_val;
  RETURN 'a' || next_val::TEXT;
END;
$$;
