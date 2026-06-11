-- Fix RLS policies to include 'super-admin' for legacy tables

-- 1. Tasks: "Admins can manage tasks."
DROP POLICY IF EXISTS "Admins can manage tasks." ON public.tasks;
CREATE POLICY "Admins can manage tasks." ON public.tasks FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'super-admin')
  )
);

-- 2. User Tasks: "Admins can view all assignments."
DROP POLICY IF EXISTS "Admins can view all assignments." ON public.user_tasks;
CREATE POLICY "Admins can view all assignments." ON public.user_tasks FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'super-admin')
  )
);

-- 3. Leads: "Admins can view all leads."
DROP POLICY IF EXISTS "Admins can view all leads." ON public.leads;
CREATE POLICY "Admins can view all leads." ON public.leads FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'super-admin')
  )
);

-- 4. Leads: "Admins can update leads (review)."
DROP POLICY IF EXISTS "Admins can update leads (review)." ON public.leads;
CREATE POLICY "Admins can update leads (review)." ON public.leads FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'super-admin')
  )
);
