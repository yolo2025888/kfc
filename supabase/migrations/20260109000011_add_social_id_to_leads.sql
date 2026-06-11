-- Merged migration: Directly add social_id to leads table
alter table public.leads add column if not exists social_id text;
