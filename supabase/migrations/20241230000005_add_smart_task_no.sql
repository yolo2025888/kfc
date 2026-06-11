-- 1. Create a sequence starting from 10001 (if not exists)
CREATE SEQUENCE IF NOT EXISTS public.tasks_task_no_seq START 10001;

-- 2. Add task_no column to tasks table (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='task_no') THEN
        ALTER TABLE public.tasks ADD COLUMN task_no text;
    END IF;
END $$;

-- 3. Define the smart generation function
CREATE OR REPLACE FUNCTION public.generate_task_no()
RETURNS TRIGGER AS $$
DECLARE
    prefix text;
    next_val bigint;
BEGIN
    -- Determine prefix based on platform
    CASE NEW.platform
        WHEN 'xiaohongshu' THEN prefix := 'X-';
        WHEN 'douyin' THEN prefix := 'D-';
        WHEN 'gpt' THEN prefix := 'G-';
        ELSE prefix := 'T-'; -- Default for 'other' or unknown
    END CASE;

    -- Get next value from the sequence
    next_val := nextval('public.tasks_task_no_seq');

    -- Set the task_no
    NEW.task_no := prefix || next_val::text;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create/Update the trigger
DROP TRIGGER IF EXISTS set_task_no_trigger ON public.tasks;
CREATE TRIGGER set_task_no_trigger
BEFORE INSERT ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.generate_task_no();

-- 5. Backfill existing data (if any)
UPDATE public.tasks 
SET task_no = (
    CASE platform
        WHEN 'xiaohongshu' THEN 'X-'
        WHEN 'douyin' THEN 'D-'
        WHEN 'gpt' THEN 'G-'
        ELSE 'T-'
    END || nextval('public.tasks_task_no_seq')::text
)
WHERE task_no IS NULL;

-- 6. Enforce constraints
ALTER TABLE public.tasks ALTER COLUMN task_no SET NOT NULL;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_task_no_key;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_task_no_key UNIQUE (task_no);

-- 7. Add comment
COMMENT ON COLUMN public.tasks.task_no IS 'Smart formatted task ID (e.g., X-10001, D-10002)';
