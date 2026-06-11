-- Update the view to include task statistics
CREATE OR REPLACE VIEW public.user_stats_view AS
SELECT 
    p.id as user_id,
    p.email,
    p.full_name,
    p.role,
    p.remark,
    p.created_at,
    -- Leads stats
    (SELECT COUNT(*) FROM public.leads l WHERE l.user_id = p.id) as total_leads,
    (SELECT COUNT(*) FROM public.leads l WHERE l.user_id = p.id AND l.created_at >= CURRENT_DATE) as today_leads,
    -- Tasks stats
    (SELECT COUNT(*) FROM public.user_tasks ut WHERE ut.user_id = p.id) as total_tasks,
    (SELECT COUNT(*) FROM public.user_tasks ut WHERE ut.user_id = p.id AND ut.created_at >= CURRENT_DATE) as today_tasks
FROM 
    public.profiles p;

-- Grant access (idempotent)
GRANT SELECT ON public.user_stats_view TO authenticated;
GRANT SELECT ON public.user_stats_view TO service_role;
