-- 1. Add invited_by column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES public.profiles(id);

-- 2. Index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_invited_by ON public.profiles(invited_by);

-- 3. Update user_stats_view to include invite_count and short_id
DROP VIEW IF EXISTS public.user_stats_view;

CREATE OR REPLACE VIEW public.user_stats_view AS
SELECT  
    p.id as user_id,
    p.email,
    p.full_name,
    p.short_id,
    p.role,
    p.remark,
    p.created_at,
    p.invited_by,
    
    -- Leads stats (Strict: only verified or further stages)
    (SELECT COUNT(*) 
     FROM public.leads l 
     WHERE l.user_id = p.id 
     AND l.status IN ('verified', 'claimed', 'done', 'completed')
    ) as total_leads,
    
    (SELECT COUNT(*) 
     FROM public.leads l 
     WHERE l.user_id = p.id 
     AND l.created_at >= CURRENT_DATE 
     AND l.status IN ('verified', 'claimed', 'done', 'completed')
    ) as today_leads,
    
    -- Tasks stats (Strict: only link_status approved)
    (SELECT COUNT(*) 
     FROM public.user_tasks ut 
     WHERE ut.user_id = p.id 
     AND ut.link_status = 'approved'
    ) as total_tasks,
    
    (SELECT COUNT(*) 
     FROM public.user_tasks ut 
     WHERE ut.user_id = p.id 
     AND ut.created_at >= CURRENT_DATE 
     AND ut.link_status = 'approved'
    ) as today_tasks,

    -- Invite count
    (SELECT COUNT(*)
     FROM public.profiles sub
     WHERE sub.invited_by = p.id
    ) as invite_count
FROM 
    public.profiles p;

-- Ensure permissions
GRANT SELECT ON public.user_stats_view TO authenticated;
GRANT SELECT ON public.user_stats_view TO service_role;
