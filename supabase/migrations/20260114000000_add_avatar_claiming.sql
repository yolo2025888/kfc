-- Add claim columns to avatar_library
-- We reference public.profiles instead of auth.users to make PostgREST relationship detection easier
ALTER TABLE public.avatar_library 
ADD COLUMN IF NOT EXISTS claimed_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

-- Function for a user to claim an avatar (Atomic operation)
CREATE OR REPLACE FUNCTION public.claim_avatar(p_avatar_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_avatar_id UUID;
BEGIN
    -- Get current user ID
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    -- Try to update ONLY if currently unclaimed
    UPDATE public.avatar_library
    SET 
        claimed_by = v_user_id,
        claimed_at = now()
    WHERE id = p_avatar_id AND claimed_by IS NULL
    RETURNING id INTO v_avatar_id;

    IF v_avatar_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', true);
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'Avatar already claimed or not found');
    END IF;
END;
$$;

-- Function for admin to release/unclaim an avatar
CREATE OR REPLACE FUNCTION public.admin_release_avatar(p_avatar_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if user is admin (simple check, RLS should handle overall access but this is extra safety)
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND (role = 'admin' OR role = 'super-admin')
    ) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    UPDATE public.avatar_library
    SET 
        claimed_by = NULL,
        claimed_at = NULL
    WHERE id = p_avatar_id;
END;
$$;