-- Create a view to aggregate user statistics
CREATE OR REPLACE VIEW public.user_stats_view AS
SELECT 
    p.id as user_id,
    p.email,
    p.full_name,
    p.role,
    p.remark,
    p.created_at,
    -- Count total leads
    (SELECT COUNT(*) FROM public.leads l WHERE l.user_id = p.id) as total_leads,
    -- Count today's leads (using timezone based on typical server config, ideally UTC)
    (SELECT COUNT(*) FROM public.leads l WHERE l.user_id = p.id AND l.created_at >= CURRENT_DATE) as today_leads
FROM 
    public.profiles p;

-- Grant access to authenticated users (or service role)
GRANT SELECT ON public.user_stats_view TO authenticated;
GRANT SELECT ON public.user_stats_view TO service_role;
