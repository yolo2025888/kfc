-- Fix for 400 Error in RPC
-- Uses explicit cardinality checks and early return to prevent invalid SQL states with NULL arrays.

create or replace function public.get_latest_tasks_for_user(
  p_user_id uuid,
  p_limit_per_platform int default 4
)
returns setof public.tasks
language plpgsql
security definer
as $$
declare
  v_visible_platforms text[];
  v_visible_categories text[];
begin
  -- 1. Get user permissions
  select visible_platforms, visible_categories
  into v_visible_platforms, v_visible_categories
  from public.profiles
  where id = p_user_id;

  -- 2. Security Check: Early Exit
  -- If platform list is NULL or Empty, user sees NOTHING.
  -- coalesce(cardinality(...), 0) handles both NULL and Empty array safely.
  if coalesce(cardinality(v_visible_platforms), 0) = 0 then
     return; -- Returns empty set immediately
  end if;

  -- 3. Category Security Check
  -- If category list is NULL or Empty, user sees NOTHING (Strict Mode).
  if coalesce(cardinality(v_visible_categories), 0) = 0 then
     return;
  end if;

  return query
  with ranked_tasks as (
    select t.*,
           row_number() over (partition by t.platform order by t.created_at desc) as rn
    from public.tasks t
    where t.status = 'open'
      -- Platform check (Safe to use = ANY now)
      and t.platform = any(v_visible_platforms)
      
      -- Category check (Safe to use = ANY now)
      and t.category_id::text = any(v_visible_categories)
  )
  select 
    id, category_id, content, created_at, created_by, guest_description, 
    images, platform, remark, reward_amount, status, task_no, title, updated_at
  from ranked_tasks
  where rn <= p_limit_per_platform
  order by created_at desc;
end;
$$;
