-- Drop the old view first to avoid column mismatch errors
drop view if exists public.admin_tasks_stats_view;

-- Re-create view for 1-to-1 task model using LATERAL JOIN
create or replace view public.admin_tasks_stats_view as
select 
  t.*,
  latest_ut.id as participant_link_id,
  latest_ut.user_id as participant_user_id,
  latest_ut.link_status as link_status,
  p.full_name as participant_name,
  p.avatar_url as participant_avatar,
  
  -- Keep total count for reference (optional, but good for debugging)
  (select count(*) from public.user_tasks ut_count where ut_count.task_id = t.id) as total_participants,
  
  -- Add these back to satisfy frontend if it was using them, though we changed the frontend logic.
  -- But since we DROP, we can define whatever we want now.
  -- Let's stick to the new clean structure.
  
  -- Pending count (for sorting/filtering convenience)
  (case when latest_ut.link_status = 'pending' then 1 else 0 end) as link_pending_count

from public.tasks t
left join lateral (
  select * from public.user_tasks ut
  where ut.task_id = t.id
  order by ut.created_at desc
  limit 1
) latest_ut on true
left join public.profiles p on latest_ut.user_id = p.id
order by t.created_at desc;

-- Grant access
grant select on public.admin_tasks_stats_view to authenticated;
grant select on public.admin_tasks_stats_view to service_role;
