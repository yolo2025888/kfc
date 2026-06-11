-- Add updated_at column to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL;

-- Create or replace the function to update the timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS on_leads_updated ON public.leads;
CREATE TRIGGER on_leads_updated
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();
