-- Create platforms table for dynamic configuration
create table public.platforms (
  id text primary key, -- slug/key like 'xiaohongshu', 'douyin'
  name text not null, -- Display name like '小红书'
  color text default 'gray', -- UI badge color hint: 'red', 'blue', 'green', etc.
  created_at timestamptz default now(),
  is_active boolean default true
);

-- Enable RLS
alter table public.platforms enable row level security;

-- Policies: Everyone can read active platforms, Admins can manage
create policy "Everyone can read platforms" on public.platforms for select using (true);
create policy "Admins can insert platforms" on public.platforms for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super-admin'))
);
create policy "Admins can update platforms" on public.platforms for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super-admin'))
);
create policy "Admins can delete platforms" on public.platforms for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super-admin'))
);

-- Insert default data to match existing hardcoded values
insert into public.platforms (id, name, color) values
  ('xiaohongshu', '小红书', 'red'),
  ('douyin', '抖音', 'slate'),
  ('gpt', 'GPT 任务', 'indigo'),
  ('other', '其他', 'gray')
on conflict (id) do nothing;
