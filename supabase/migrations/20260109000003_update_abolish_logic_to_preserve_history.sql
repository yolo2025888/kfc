-- Update the abolish_lead function to PRESERVE history instead of deleting it
create or replace function public.abolish_lead(target_lead_id uuid, reject_reason text)
returns void
language plpgsql
security definer
as $$
begin
  -- We NO LONGER delete lead_comments or lead_followups 
  -- because the admin wants to see the full history for abolished leads.

  -- Just update the status and record the reason
  update public.leads
  set 
    status = 'rejected',
    review_note = reject_reason,
    -- We keep auditor_id and claimed_at to know who was handling it
    verified_at = null -- It's no longer in the verified pool
  where id = target_lead_id;
  
end;
$$;
