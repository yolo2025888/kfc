-- Update leads status constraint to support multi-stage workflow
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;

ALTER TABLE public.leads ADD CONSTRAINT leads_status_check 
CHECK (status IN ('pending', 'verified', 'claimed', 'completed', 'approved', 'rejected'));
-- kept 'approved' for backward compatibility if needed, but we will move to 'verified'
