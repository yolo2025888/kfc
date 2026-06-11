-- Table to track when a user last read a lead's chat
create table public.lead_reads (
  user_id uuid references public.profiles(id) on delete cascade not null,
  lead_id uuid references public.leads(id) on delete cascade not null,
  last_read_at timestamptz default now() not null,
  primary key (user_id, lead_id)
);

-- Enable RLS
alter table public.lead_reads enable row level security;

-- Policy: Users can manage their own read status
create policy "Users can manage their own read status"
on public.lead_reads
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Create a View to calculate unread counts efficiently
create or replace view public.lead_unread_view as
select 
  l.id as lead_id,
  p.id as user_id,
  count(c.id) as unread_count
from public.leads l
cross join public.profiles p
left join public.lead_reads lr on lr.lead_id = l.id and lr.user_id = p.id
join public.lead_comments c on c.lead_id = l.id
where 
  c.user_id != p.id -- 排除自己发的消息
  and c.created_at > coalesce(lr.last_read_at, '1900-01-01') -- 晚于最后阅读时间
group by l.id, p.id;
