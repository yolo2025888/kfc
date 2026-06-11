-- Remove the restrictive check constraint on tasks.platform
-- This allows dynamic platform IDs managed via the 'platforms' table to be used.

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_platform_check;
