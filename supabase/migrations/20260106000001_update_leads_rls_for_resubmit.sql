-- Allow users to update their own rejected leads to resubmit
create policy "Users can update their own rejected leads"
on "public"."leads"
for update
to authenticated
using (
  (auth.uid() = user_id) AND (status = 'rejected' OR status = 'pending')
)
with check (
  (auth.uid() = user_id) AND (status = 'pending')
);
