-- Fix RPC return type mismatch by joining back to the source table
-- This ensures the returned row structure matches 'public.tasks' exactly

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
    select t.id,
           row_number() over (partition by t.platform order by t.created_at desc) as rn
    from public.tasks t
    where t.status = 'open'
      -- Platform check
      and (
        v_visible_platforms is null 
        or (
            v_visible_platforms is not null 
            and array_length(v_visible_platforms, 1) > 0 
            and t.platform = any(v_visible_platforms)
        )
      )
      -- Category check
      and (
        v_visible_categories is null 
        or (
            v_visible_categories is not null 
            and array_length(v_visible_categories, 1) > 0 
            and t.category_id::text = any(v_visible_categories)
        )
      )
  )
  -- 2. Join back to the original table to ensure strict return type matching
  select t.*
  from public.tasks t
  inner join ranked_tasks rt on t.id = rt.id
  where rt.rn <= p_limit_per_platform
  order by t.created_at desc;
end;
$$;
