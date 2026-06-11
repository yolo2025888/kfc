-- Fix lead_reads RLS to allow staff to see each other's read status
-- Without this, Realtime will NOT broadcast the other person's read status to you.

drop policy if exists "Users can manage their own read status" on public.lead_reads;

-- 1. Everyone can update their own status
create policy "Users can update their own read status"
on public.lead_reads
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can modify their own read status"
on public.lead_reads
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- 2. Staff (Admin/Auditor) can see all read statuses for syncing
create policy "Staff can view all read statuses"
on public.lead_reads
for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role in ('admin', 'super-admin', 'auditor')
  )
);
