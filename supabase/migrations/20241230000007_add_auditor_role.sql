-- Update the role check constraint to include 'auditor' and 'super-admin'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('admin', 'user', 'super-admin', 'auditor'));

-- Comment
COMMENT ON COLUMN public.profiles.role IS 'User roles: user, admin, super-admin, auditor';
