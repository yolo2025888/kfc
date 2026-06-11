-- Function to abolish (reject) a lead that was already verified or claimed
-- This resets the lead to 'rejected' status and clears operational data
create or replace function public.abolish_lead(target_lead_id uuid, reject_reason text)
returns void
language plpgsql
security definer
as $$
begin
  -- 1. Delete all chat history (optional, but keeps it clean if we treat this as a "reset to rejected")
  delete from public.lead_comments
  where lead_id = target_lead_id;

  -- 2. Delete all follow-up data
  delete from public.lead_followups
  where lead_id = target_lead_id;
  
  -- 3. Update lead status to rejected
  update public.leads
  set 
    status = 'rejected',
    review_note = reject_reason,
    auditor_id = null,
    claimed_at = null,
    verified_at = null -- Clear verification timestamp as it is no longer verified
  where id = target_lead_id;
  
end;
$$;
