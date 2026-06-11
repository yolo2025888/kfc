ALTER TABLE public.leads 
ADD COLUMN verified_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN claimed_at TIMESTAMPTZ DEFAULT NULL;

-- Backfill verified_at for existing verified/claimed leads using updated_at as a best guess
UPDATE public.leads 
SET verified_at = updated_at 
WHERE status IN ('verified', 'claimed', 'done', 'completed') AND verified_at IS NULL;
