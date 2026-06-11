-- Fix for 42804 Error (Column Order Mismatch)
-- Using INNER JOIN pattern to return t.* ensuring exact table structure match.

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
  if coalesce(cardinality(v_visible_platforms), 0) = 0 then
     return;
  end if;

  if coalesce(cardinality(v_visible_categories), 0) = 0 then
     return;
  end if;

  -- 3. Query using ID join to ensure correct return type structure
  return query
  with filtered_tasks as (
    select id,
           row_number() over (partition by platform order by created_at desc) as rn
    from public.tasks
    where status = 'open'
      and platform = any(v_visible_platforms)
      and category_id::text = any(v_visible_categories)
  )
  select t.*
  from public.tasks t
  inner join filtered_tasks ft on t.id = ft.id
  where ft.rn <= p_limit_per_platform
  order by t.created_at desc;
end;
$$;
