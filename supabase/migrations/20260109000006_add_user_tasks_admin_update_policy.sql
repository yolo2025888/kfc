-- Grant admins permission to update user_tasks (e.g. for link review)
create policy "Admins can update user_tasks"
on public.user_tasks
for update
to authenticated
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role in ('admin', 'super-admin')
  )
)
with check (
  exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role in ('admin', 'super-admin')
  )
);
