-- Fix RLS for user_platform_accounts to support RBAC roles
DROP POLICY IF EXISTS "Staff can view all platform accounts" ON public.user_platform_accounts;

CREATE POLICY "Staff can view all platform accounts" 
ON public.user_platform_accounts FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND (
      -- Legacy Check
      profiles.role IN ('admin', 'super_admin', 'super-admin', 'auditor')
      OR
      -- RBAC Check: If user has a custom role that maps to admin/auditor codes
      profiles.custom_role_id IN (
        SELECT id FROM public.app_roles WHERE code IN ('admin', 'super_admin', 'auditor')
      )
    )
  )
);
