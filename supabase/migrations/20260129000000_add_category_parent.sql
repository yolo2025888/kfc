-- Add parent_id to categories table for sub-categories support
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

-- Add index for better performance when querying sub-categories
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON public.categories(parent_id);
