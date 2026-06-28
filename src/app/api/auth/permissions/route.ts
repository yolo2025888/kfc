import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';
import { NextResponse } from 'next/server';
import { createSSRClient } from '@/lib/supabase/server';
import { Database } from '@/lib/types';
import { getErrorMessage } from '@/lib/utils';

type PermissionRow = Database['public']['Tables']['app_permissions']['Row'];
type RolePermissionRow = { permission: PermissionRow | null };

export async function GET() {
  try {
    const supabase = await createSSRClient(); 
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        console.error('Auth check failed:', authError);
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createServerAdminClient();

    // 1. Get User Profile to check role
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('role, custom_role_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
        console.error('Profile fetch error:', profileError);
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    let roleId = profile.custom_role_id;

    // 2. If no custom role, find ID by code (legacy role)
    if (!roleId) {
      let roleCode = profile.role;
      // Normalization: our seed data uses 'super_admin', but profile might store 'super-admin'
      if (roleCode === 'super-admin') roleCode = 'super_admin';

      if (!roleCode) {
        return NextResponse.json({ permissions: [] });
      }

      const { data: role, error: roleLookupError } = await adminClient
        .from('app_roles')
        .select('id')
        .eq('code', roleCode) 
        .maybeSingle();
      
      if (roleLookupError) {
          console.error('Role lookup error:', roleLookupError);
          // Don't throw, just log. We'll handle no-role below.
      }
      
      if (role) roleId = role.id;
    }

    // If still no role ID found
    if (!roleId) {
        console.warn(`No role mapping found for user ${user.id} (Role: ${profile.role})`);
        return NextResponse.json({ permissions: [] });
    }

    // 3. Get Permissions via Join
    const { data: rolePerms, error: permsError } = await adminClient
      .from('app_role_permissions')
      .select('permission:app_permissions(*)')
      .eq('role_id', roleId);

    if (permsError) {
        console.error('Role permissions fetch error:', permsError);
        throw permsError;
    }

    // Extract and Sort
    const permissions = ((rolePerms ?? []) as unknown as RolePermissionRow[])
      .map((rp) => rp.permission)
      .filter((p): p is PermissionRow => Boolean(p && p.type === 'menu')) 
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    return NextResponse.json({ permissions: permissions || [] });

  } catch (e) {
    console.error('Permissions API Critical Error:', e);
    return NextResponse.json({ error: getErrorMessage(e, 'Internal Server Error') }, { status: 500 });
  }
}
