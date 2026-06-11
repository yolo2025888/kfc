-- 1. Leads Table: Allow Auditors to view and update
CREATE POLICY "Auditors can view all leads." ON public.leads FOR SELECT USING (
  exists (select 1 from public.profiles where id = auth.uid() and role IN ('admin', 'super-admin', 'auditor'))
);

CREATE POLICY "Auditors can update leads (review)." ON public.leads FOR UPDATE USING (
  exists (select 1 from public.profiles where id = auth.uid() and role IN ('admin', 'super-admin', 'auditor'))
);

-- 2. Tasks Table: Allow Auditors to view all (already allowed by public view, but let's be explicit)
CREATE POLICY "Auditors can view all tasks." ON public.tasks FOR SELECT USING (
  exists (select 1 from public.profiles where id = auth.uid() and role IN ('admin', 'super-admin', 'auditor'))
);

-- 3. User Tasks Table: Allow Auditors to view all assignments
CREATE POLICY "Auditors can view all assignments." ON public.user_tasks FOR SELECT USING (
  exists (select 1 from public.profiles where id = auth.uid() and role IN ('admin', 'super-admin', 'auditor'))
);

-- 4. Profiles Table: Allow Auditors to view other profiles (necessary for showing who submitted what)
-- Existing policy is public, so no changes needed there.
