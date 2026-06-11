-- Drop the existing constraint
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_platform_check;

-- Re-add the constraint with 'gpt' included
ALTER TABLE public.tasks 
ADD CONSTRAINT tasks_platform_check 
CHECK (platform IN ('xiaohongshu', 'douyin', 'other', 'gpt'));
