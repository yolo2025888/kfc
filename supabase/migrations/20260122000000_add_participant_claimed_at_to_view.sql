-- Update view to include participant_claimed_at
drop view if exists public.admin_tasks_stats_view;

create or replace view public.admin_tasks_stats_view as
select 
  t.*,
  latest_ut.id as participant_link_id,
  latest_ut.user_id as participant_user_id,
  latest_ut.link_status as link_status,
  latest_ut.proof_urls as participant_proof_urls,
  latest_ut.created_at as participant_claimed_at,
  p.full_name as participant_name,
  p.avatar_url as participant_avatar,
  (case when latest_ut.link_status = 'pending' then 1 else 0 end) as link_pending_count,
  (
    select count(*) 
    from public.leads l 
    where l.user_task_id = latest_ut.id
  ) as leads_count
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
