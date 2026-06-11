-- Create lead_comments table for internal communication
create table public.lead_comments (
  id uuid default gen_random_uuid() primary key,
  lead_id uuid references public.leads(id) on delete cascade not null,
  user_id uuid references public.profiles(id) not null,
  content text not null,
  created_at timestamptz default now() not null
);

-- Enable RLS
alter table public.lead_comments enable row level security;

-- Enable Realtime
alter publication supabase_realtime add table public.lead_comments;

-- Policy: Admins and Auditors can view comments
create policy "Admins and Auditors can view comments"
on public.lead_comments
for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role in ('admin', 'super-admin', 'auditor')
  )
);

-- Policy: Admins and Auditors can insert comments
create policy "Admins and Auditors can insert comments"
on public.lead_comments
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role in ('admin', 'super-admin', 'auditor')
  )
);
