-- Add the missing 'Roles Management' menu item
INSERT INTO public.app_permissions (code, name, type, path, icon, sort_order, is_special, with_spacing)
VALUES ('menu:admin_roles', '角色管理', 'menu', '/app/admin/roles', 'Shield', 70, false, false)
ON CONFLICT (code) DO NOTHING;

-- Assign to Admin
INSERT INTO public.app_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.app_roles r, public.app_permissions p
WHERE r.code = 'admin' AND p.code = 'menu:admin_roles'
ON CONFLICT DO NOTHING;

-- Assign to Super Admin
INSERT INTO public.app_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.app_roles r, public.app_permissions p
WHERE r.code = 'super_admin' AND p.code = 'menu:admin_roles'
ON CONFLICT DO NOTHING;
