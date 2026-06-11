-- 1. Create Roles Table
CREATE TABLE IF NOT EXISTS public.app_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE, 
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Permissions Table (Menu Items)
CREATE TABLE IF NOT EXISTS public.app_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE, 
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('menu', 'action', 'page')),
  path TEXT, 
  icon TEXT, 
  parent_code TEXT REFERENCES public.app_permissions(code),
  sort_order INT DEFAULT 0,
  is_special BOOLEAN DEFAULT FALSE, 
  with_spacing BOOLEAN DEFAULT FALSE, 
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Role-Permissions Junction
CREATE TABLE IF NOT EXISTS public.app_role_permissions (
  role_id UUID REFERENCES public.app_roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES public.app_permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- 4. Add custom_role_id to profiles for future use
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS custom_role_id UUID REFERENCES public.app_roles(id);

-- 5. Seed Initial Data (Roles)
INSERT INTO public.app_roles (code, name, description) VALUES
('super_admin', '超级管理员', '拥有系统最高权限'),
('admin', '运营管理员', '管理任务、用户及基础配置'),
('auditor', '邀约员', '管理客资审核与跟进'),
('user', '普通用户', '接单与提交任务')
ON CONFLICT (code) DO NOTHING;

-- 6. Seed Initial Permissions (Menus based on current AppLayout)
INSERT INTO public.app_permissions (code, name, type, path, icon, sort_order, is_special, with_spacing) VALUES
-- Common
('menu:home', '首页', 'menu', '/app', 'Home', 10, false, false),
('menu:tasks_hall', '任务大厅', 'menu', '/app/tasks', 'Briefcase', 20, false, false),
('menu:settings', '个人设置', 'menu', '/app/users', 'User', 900, false, false),

-- Admin/Operations
('menu:admin_tasks', '任务管理', 'menu', '/app/admin/tasks', 'ShieldCheck', 30, false, true),
('menu:avatars_public', '官方头像库', 'menu', '/app/avatars', 'Users', 40, false, false),
('menu:admin_avatars', '头像库设置', 'menu', '/app/admin/avatars', 'Settings2', 45, false, true),
('menu:admin_platforms', '平台配置', 'menu', '/app/admin/platforms', 'Settings2', 50, false, false),
('menu:admin_categories', '类目配置', 'menu', '/app/admin/categories', 'Settings2', 55, false, true),
('menu:admin_users', '用户管理', 'menu', '/app/admin/users', 'Users', 60, false, false),
('menu:admin_users_add', '新增用户', 'menu', '/app/admin/users/add', 'UserPlus', 65, false, false),
('menu:leads_center', '客资中心', 'menu', '/app/admin/reviews', 'ClipboardCheck', 100, true, false),

-- User Specific
('menu:my_leads', '我的客资', 'menu', '/app/leads', 'FileText', 25, false, false),

-- Auditor Specific
('menu:my_history', '我的对接', 'menu', '/app/admin/reviews/history', 'History', 105, false, false)
ON CONFLICT (code) DO UPDATE SET 
  path = EXCLUDED.path, 
  icon = EXCLUDED.icon, 
  sort_order = EXCLUDED.sort_order,
  is_special = EXCLUDED.is_special,
  with_spacing = EXCLUDED.with_spacing;

-- 7. Initial Role-Permission Mapping (Mirroring current hardcoded logic)

-- Admin Mapping
INSERT INTO public.app_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.app_roles r, public.app_permissions p
WHERE r.code = 'admin' 
AND p.code IN (
  'menu:home', 'menu:tasks_hall', 'menu:admin_tasks', 
  'menu:avatars_public', 'menu:admin_avatars',
  'menu:admin_platforms', 'menu:admin_categories',
  'menu:admin_users', 'menu:admin_users_add', 'menu:settings',
  'menu:leads_center'
)
ON CONFLICT DO NOTHING;

-- Auditor Mapping
INSERT INTO public.app_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.app_roles r, public.app_permissions p
WHERE r.code = 'auditor' 
AND p.code IN (
  'menu:leads_center', 'menu:my_history'
)
ON CONFLICT DO NOTHING;

-- User Mapping
INSERT INTO public.app_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.app_roles r, public.app_permissions p
WHERE r.code = 'user' 
AND p.code IN (
  'menu:home', 'menu:tasks_hall', 'menu:my_leads', 
  'menu:avatars_public', 'menu:settings'
)
ON CONFLICT DO NOTHING;

-- Super Admin Mapping (Gets everything)
INSERT INTO public.app_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.app_roles r, public.app_permissions p
WHERE r.code = 'super_admin'
ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE public.app_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_role_permissions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public read app_roles" ON public.app_roles FOR SELECT USING (true);
CREATE POLICY "Public read app_permissions" ON public.app_permissions FOR SELECT USING (true);
CREATE POLICY "Public read app_role_permissions" ON public.app_role_permissions FOR SELECT USING (true);

-- Admin Management (Hardcoded to legacy 'admin' role for now)
CREATE POLICY "Admin manage roles" ON public.app_roles FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);
CREATE POLICY "Admin manage permissions" ON public.app_permissions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);
CREATE POLICY "Admin manage role_permissions" ON public.app_role_permissions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);
