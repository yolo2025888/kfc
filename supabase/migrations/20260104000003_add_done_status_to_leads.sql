-- Update leads status constraint to support 'done' state for secondary confirmation
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;

ALTER TABLE public.leads ADD CONSTRAINT leads_status_check 
CHECK (status IN ('pending', 'verified', 'claimed', 'done', 'completed', 'approved', 'rejected'));
