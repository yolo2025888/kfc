-- Create lead_followups table for auditor follow-up records
create table public.lead_followups (
  id uuid default gen_random_uuid() primary key,
  lead_id uuid references public.leads(id) on delete cascade not null,
  user_id uuid references public.profiles(id) not null,
  media_urls text[] default '{}',
  is_wechat_added boolean default false,
  created_at timestamptz default now() not null
);

-- Enable RLS
alter table public.lead_followups enable row level security;

-- Enable Realtime (optional, but good for sync)
do $$ 
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'lead_followups') then
    alter publication supabase_realtime add table lead_followups;
  end if;
end $$;

-- Policy: Admins and Auditors can view and insert/update
create policy "Staff can manage followups"
on public.lead_followups
for all
to authenticated
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role in ('admin', 'super-admin', 'auditor')
  )
)
with check (
  exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role in ('admin', 'super-admin', 'auditor')
  )
);
