import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';
import { NextResponse } from 'next/server';
import { isCurrentUserAdmin } from '@/lib/auth/admin';
import { Database } from '@/lib/types';

function unauthorized() {
  return NextResponse.json(
    { error: 'Unauthorized: Only administrators can perform this action.' },
    { status: 403 }
  );
}

type AppRoleWithPermissions = Database['public']['Tables']['app_roles']['Row'] & {
  app_role_permissions: Array<{ permission_id: string }> | null;
};

export async function GET() {
  if (!(await isCurrentUserAdmin())) return unauthorized();

  const supabase = createServerAdminClient();
  
  // Get roles with their permission IDs
  // We join app_role_permissions table
  const { data: roles, error } = await supabase
    .from('app_roles')
    .select('*, app_role_permissions(permission_id)')
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Transform data: role.permission_ids = ['id1', 'id2']
  const formattedRoles = ((roles ?? []) as AppRoleWithPermissions[]).map((r) => ({
    ...r,
    permission_ids: (r.app_role_permissions ?? []).map((rp) => rp.permission_id)
  }));

  return NextResponse.json({ data: formattedRoles });
}

export async function POST(req: Request) {
  if (!(await isCurrentUserAdmin())) return unauthorized();

  const supabase = createServerAdminClient();
  const { name, code, description, permission_ids } = await req.json();

  if (!name || !code) {
    return NextResponse.json({ error: 'Name and Code are required' }, { status: 400 });
  }

  // 1. Create Role
  const { data: role, error: roleError } = await supabase
    .from('app_roles')
    .insert({ name, code, description })
    .select()
    .single();

  if (roleError) return NextResponse.json({ error: roleError.message }, { status: 400 });

  // 2. Assign Permissions
  if (permission_ids && Array.isArray(permission_ids) && permission_ids.length > 0) {
    const records = permission_ids.map((pid: string) => ({
      role_id: role.id,
      permission_id: pid
    }));
    const { error: permError } = await supabase.from('app_role_permissions').insert(records);
    if (permError) console.error('Error assigning permissions', permError);
  }

  return NextResponse.json({ data: role });
}

export async function PUT(req: Request) {
  if (!(await isCurrentUserAdmin())) return unauthorized();

  const supabase = createServerAdminClient();
  const { id, name, description, permission_ids } = await req.json();

  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  // 1. Update Basic Info
  const { error: updateError } = await supabase
    .from('app_roles')
    .update({ name, description })
    .eq('id', id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  // 2. Update Permissions (Sync Strategy: Delete All -> Insert New)
  // Delete existing mappings
  const { error: delError } = await supabase
    .from('app_role_permissions')
    .delete()
    .eq('role_id', id);
    
  if (delError) console.error('Error clearing permissions', delError);

  // Insert new mappings
  if (permission_ids && Array.isArray(permission_ids) && permission_ids.length > 0) {
    const records = permission_ids.map((pid: string) => ({
      role_id: id,
      permission_id: pid
    }));
    const { error: insertError } = await supabase.from('app_role_permissions').insert(records);
    if (insertError) console.error('Error setting new permissions', insertError);
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
    if (!(await isCurrentUserAdmin())) return unauthorized();

    const supabase = createServerAdminClient();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const { error } = await supabase.from('app_roles').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ success: true });
}
