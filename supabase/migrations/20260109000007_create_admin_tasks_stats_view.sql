-- Create a view to provide task statistics for admin dashboard
-- Includes counts for participants and link review status

create or replace view public.admin_tasks_stats_view as
select 
  t.*,
  -- Count all participants
  (select count(*) from public.user_tasks ut where ut.task_id = t.id) as total_participants,
  
  -- Count participants who have submitted links (non-empty array)
  (select count(*) from public.user_tasks ut where ut.task_id = t.id and ut.proof_urls is not null and array_length(ut.proof_urls, 1) > 0) as link_submitted_count,
  
  -- Count pending link reviews (submitted + pending status)
  (select count(*) from public.user_tasks ut where ut.task_id = t.id and ut.link_status = 'pending' and ut.proof_urls is not null and array_length(ut.proof_urls, 1) > 0) as link_pending_count

from public.tasks t
order by t.created_at desc;

-- Grant access
grant select on public.admin_tasks_stats_view to authenticated;
grant select on public.admin_tasks_stats_view to service_role;
