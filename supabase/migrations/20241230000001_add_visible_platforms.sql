-- Add visible_platforms column to profiles table
ALTER TABLE public.profiles
ADD COLUMN visible_platforms text[] DEFAULT NULL;

-- Comment on column
COMMENT ON COLUMN public.profiles.visible_platforms IS 'Array of platform codes that the user is allowed to see. If NULL or empty, implies access to all or default platforms.';
