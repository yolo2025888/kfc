-- Update user_stats_view to reflect strict counting rules
-- Tasks: Only count if link_status is 'approved'
-- Leads: Only count if status is verified/claimed/done/completed (passed admin review)

CREATE OR REPLACE VIEW public.user_stats_view AS
SELECT 
    p.id as user_id,
    p.email,
    p.full_name,
    p.role,
    p.remark,
    p.created_at,
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
    ) as today_tasks
FROM 
    public.profiles p;

-- Ensure permissions
GRANT SELECT ON public.user_stats_view TO authenticated;
GRANT SELECT ON public.user_stats_view TO service_role;
