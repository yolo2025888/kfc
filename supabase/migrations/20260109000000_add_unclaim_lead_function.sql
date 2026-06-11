-- Create a function to handle lead unclaiming with full cleanup
-- Security Definer allows this function to bypass RLS to ensure all related data is cleaned up
create or replace function public.unclaim_lead(target_lead_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  -- 1. Delete all chat history for this lead
  delete from public.lead_comments
  where lead_id = target_lead_id;

  -- 2. Delete all follow-up data for this lead
  delete from public.lead_followups
  where lead_id = target_lead_id;
  
  -- 3. Reset lead status and timestamps
  update public.leads
  set 
    status = 'verified',
    auditor_id = null,
    claimed_at = null,
    verified_at = now() -- Update verified_at to now so it appears at the top of the pool/refreshed
  where id = target_lead_id;
  
end;
$$;
