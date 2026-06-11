-- Update the function to handle verified_at timestamp if it's missing (e.g. direct assign from pending)
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
  -- If verified_at is NULL (skipping pending->verified step), set it to NOW() as well
  UPDATE leads
  SET 
    status = 'claimed',
    auditor_id = target_auditor_id,
    verified_at = COALESCE(verified_at, NOW()),
    claimed_at = NOW(),
    updated_at = NOW()
  WHERE id = target_lead_id;

END;
$$;
