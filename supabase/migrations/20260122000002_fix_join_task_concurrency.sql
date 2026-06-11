-- Fix race condition in join_task function
-- Use atomic update to ensure only one user can claim the task

create or replace function public.join_task(p_task_id uuid, p_user_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_new_id uuid;
  v_rows_updated int;
begin
  -- Attempt to lock the task by updating it.
  -- This is atomic. Only one transaction will succeed in updating row where status='open'.
  update public.tasks 
  set status = 'ongoing' 
  where id = p_task_id and status = 'open';

  get diagnostics v_rows_updated = row_count;

  if v_rows_updated = 0 then
    -- If no rows updated, it means task doesn't exist or is not open anymore
    raise exception '手慢了，任务已被抢！';
  end if;

  -- Insert user_task record only if we successfully updated the task status
  insert into public.user_tasks (task_id, user_id, status)
  values (p_task_id, p_user_id, 'in_progress')
  returning id into v_new_id;

  return json_build_object('id', v_new_id);
end;
$$;
