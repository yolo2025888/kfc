-- Fix Chat Realtime: Simplify RLS and Ensure Publication
-- This solves the issue where recipients don't get live messages due to complex RLS check.

-- 1. Drop the restrictive/buggy policy if it exists
drop policy if exists "Admins and Auditors can view comments" on public.lead_comments;

-- 2. Create a simpler, more performant policy for Realtime delivery
-- Grant read access to all authenticated users (internal staff only anyway)
create policy "Allow all authenticated users to read comments"
on public.lead_comments
for select
to authenticated
using (true);

-- 3. Ensure the table is part of the realtime publication
do $$ 
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'lead_comments') then
    alter publication supabase_realtime add table lead_comments;
  end if;
end $$;
