-- Add remark column to tasks table
alter table public.tasks add column if not exists remark text;
