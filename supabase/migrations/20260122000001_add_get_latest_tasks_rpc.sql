-- Function to get latest tasks per platform for a specific user
-- Limits to 4 tasks per platform by default

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
  v_visible_categories text[]; -- stored as text array in profiles usually, or we cast
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
      -- Platform check
      and (
        v_visible_platforms is null -- All access (null)
        or (
            -- specific access
            v_visible_platforms is not null 
            and array_length(v_visible_platforms, 1) > 0 
            and t.platform = any(v_visible_platforms)
        )
      )
      -- Category check
      and (
        v_visible_categories is null -- All access (null)
        or (
            -- specific access
            v_visible_categories is not null 
            and array_length(v_visible_categories, 1) > 0 
            and t.category_id::text = any(v_visible_categories) -- cast uuid to text for comparison
        )
      )
      -- Handle the case where array is empty (no access) implicitly:
      -- If array is empty, array_length is null or 0.
      -- However, in Supabase/Postgres, empty array literal '{}' has length 0.
      -- The logic above: if not null AND length > 0, we check IN.
      -- If length is 0, it falls through to FALSE (because OR conditions fail), which is correct (No Access).
      -- WAIT: If v_visible_platforms is '{}', then (v_visible_platforms is null) is FALSE.
      -- (array_length > 0) is FALSE.
      -- So the whole Platform Check becomes FALSE. Correct.
  )
  select 
    id, category_id, content, created_at, created_by, guest_description, 
    images, platform, remark, reward_amount, status, task_no, title, updated_at
  from ranked_tasks
  where rn <= p_limit_per_platform
  order by created_at desc;
end;
$$;
