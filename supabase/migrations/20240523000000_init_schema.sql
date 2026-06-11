-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Profiles Table
create table if not exists public.profiles (
  id uuid references auth.users not null primary key,
  role text not null default 'user' check (role in ('admin', 'user')),
  email text,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone." on public.profiles for select using (true);
create policy "Users can insert their own profile." on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile." on public.profiles for update using (auth.uid() = id);

-- 2. Tasks Table
create table if not exists public.tasks (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  title text not null,
  content text not null,
  images text[],
  platform text not null check (platform in ('xiaohongshu', 'douyin', 'other')),
  reward_amount decimal(10, 2) default 0,
  
  status text default 'open' check (status in ('open', 'closed', 'archived')),
  created_by uuid references public.profiles(id)
);

alter table public.tasks enable row level security;

create policy "Anyone can view open tasks." on public.tasks for select using (true);
create policy "Admins can manage tasks." on public.tasks for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- 3. User Tasks Table (Assignments)
create table if not exists public.user_tasks (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  task_id uuid references public.tasks(id) not null,
  user_id uuid references public.profiles(id) not null,
  
  status text default 'in_progress' check (status in ('in_progress', 'dropped', 'completed')),
  
  unique(task_id, user_id)
);

alter table public.user_tasks enable row level security;

create policy "Users can view own assignments." on public.user_tasks for select using (auth.uid() = user_id);
create policy "Users can create assignment." on public.user_tasks for insert with check (auth.uid() = user_id);
create policy "Users can update own assignment." on public.user_tasks for update using (auth.uid() = user_id);
create policy "Admins can view all assignments." on public.user_tasks for select using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- 4. Leads Table (Submissions)
create table if not exists public.leads (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  user_task_id uuid references public.user_tasks(id) not null,
  user_id uuid references public.profiles(id) not null,
  
  contact_info text not null,
  proof_images text[],
  
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text
);

alter table public.leads enable row level security;

create policy "Users can view own leads." on public.leads for select using (auth.uid() = user_id);
create policy "Users can insert leads." on public.leads for insert with check (auth.uid() = user_id);
create policy "Users can update own leads (before approval)." on public.leads for update using (
  auth.uid() = user_id and status = 'pending'
);
create policy "Admins can view all leads." on public.leads for select using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Admins can update leads (review)." on public.leads for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- 5. Trigger for New User
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'avatar_url',
    coalesce(new.raw_user_meta_data->>'role', 'user')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
