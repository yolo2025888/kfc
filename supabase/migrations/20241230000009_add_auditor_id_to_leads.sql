-- Add auditor_id to leads table to track who performed the review
ALTER TABLE public.leads
ADD COLUMN auditor_id uuid REFERENCES public.profiles(id);

-- Comment
COMMENT ON COLUMN public.leads.auditor_id IS 'The ID of the auditor/admin who reviewed this lead.';

-- Update RLS if needed (Auditors should be able to set this during update)
-- Existing policies already allow updates by auditors, so this new column will be included.
