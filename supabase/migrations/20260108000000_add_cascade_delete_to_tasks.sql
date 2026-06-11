-- Drop old constraints and add CASCADE for Tasks -> UserTasks
ALTER TABLE public.user_tasks
DROP CONSTRAINT IF EXISTS user_tasks_task_id_fkey;

ALTER TABLE public.user_tasks
ADD CONSTRAINT user_tasks_task_id_fkey
FOREIGN KEY (task_id)
REFERENCES public.tasks(id)
ON DELETE CASCADE;

-- Drop old constraints and add CASCADE for UserTasks -> Leads
ALTER TABLE public.leads
DROP CONSTRAINT IF EXISTS leads_user_task_id_fkey;

ALTER TABLE public.leads
ADD CONSTRAINT leads_user_task_id_fkey
FOREIGN KEY (user_task_id)
REFERENCES public.user_tasks(id)
ON DELETE CASCADE;
