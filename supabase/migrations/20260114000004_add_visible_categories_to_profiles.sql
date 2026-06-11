-- Add visible_categories to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS visible_categories UUID[] DEFAULT NULL;

-- Comment on column
COMMENT ON COLUMN public.profiles.visible_categories IS 'List of category IDs visible to the user. NULL means all categories visible.';
