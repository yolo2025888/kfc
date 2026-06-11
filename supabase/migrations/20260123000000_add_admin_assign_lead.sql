-- Create a function for admins to directly assign a lead to an auditor
CREATE OR REPLACE FUNCTION admin_assign_lead(
  target_lead_id UUID,
  target_auditor_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_role TEXT;
BEGIN
  -- Check if the executing user is an admin
  SELECT role INTO v_user_role
  FROM profiles
  WHERE id = auth.uid();

  IF v_user_role NOT IN ('admin', 'super-admin') THEN
    RAISE EXCEPTION 'Permission denied: Only admins can assign leads.';
  END IF;

  -- Update the lead
  UPDATE leads
  SET 
    status = 'claimed',
    auditor_id = target_auditor_id,
    claimed_at = NOW(),
    updated_at = NOW()
  WHERE id = target_lead_id;

  -- We do not insert into lead_reads here, the auditor will trigger that on view
  -- But we might want to ensure previous claims are cleared if any (though status flow usually prevents this)
END;
$$;
