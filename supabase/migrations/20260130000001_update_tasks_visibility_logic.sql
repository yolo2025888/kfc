-- Update RPC to enforce STRICT permission checks.
-- Previously, NULL visible_platforms/categories meant "Access All".
-- Now, NULL or Empty means "Access None".

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

  return query
  with ranked_tasks as (
    select t.*,
           row_number() over (partition by t.platform order by t.created_at desc) as rn
    from public.tasks t
    where t.status = 'open'
      -- Platform check: STRICT (NULL/Empty = No Access)
      and (
        v_visible_platforms is not null 
        and array_length(v_visible_platforms, 1) > 0 
        and t.platform = any(v_visible_platforms)
      )
      -- Category check: STRICT (NULL/Empty = No Access)
      -- Note: Tasks with NULL category_id will only be shown if NULL is explicitly in the v_visible_categories list (unlikely for text[]).
      -- So this effectively hides un-categorized tasks unless we handle them.
      -- Assuming all tasks have categories or logic is strictly whitelist.
      and (
        v_visible_categories is not null 
        and array_length(v_visible_categories, 1) > 0 
        and t.category_id::text = any(v_visible_categories)
      )
  )
  select 
    id, category_id, content, created_at, created_by, guest_description, 
    images, platform, remark, reward_amount, status, task_no, title, updated_at
  from ranked_tasks
  where rn <= p_limit_per_platform
  order by created_at desc;
end;
$$;
