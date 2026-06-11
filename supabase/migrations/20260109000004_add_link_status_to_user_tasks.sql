-- Add status tracking for task proof links
alter table public.user_tasks 
add column link_status text default 'pending' check (link_status in ('pending', 'approved', 'rejected')),
add column link_reject_reason text;

-- Update existing records: if proof_urls is not empty, set to pending (or approved if you prefer, but pending is safer)
update public.user_tasks 
set link_status = 'pending' 
where proof_urls is not null and array_length(proof_urls, 1) > 0;
