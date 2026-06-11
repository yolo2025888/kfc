import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';
import { NextResponse } from 'next/server';
import { Database } from '@/lib/types';
import { isCurrentUserAdmin } from '@/lib/auth/admin';
import { getErrorMessage } from '@/lib/utils';

export const runtime = 'edge';

export async function POST(req: Request) {
    const { email, password, role, custom_role_id, full_name, remark, visible_platforms, visible_categories } = await req.json();

    if (!email || !password || !role) {
        return NextResponse.json({ error: 'Email, password, and role are required' }, { status: 400 });
    }

    if (!(await isCurrentUserAdmin())) { 
        return NextResponse.json({ error: 'Unauthorized: Only administrators can perform this action.' }, { status: 403 });
    }

    const adminClient = createServerAdminClient();

    // 1. Create Auth User (minimal details)
    const { data: newUserAuthData, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
    });

    if (authError) {
        console.error('admin.createUser failed:', authError);
        return NextResponse.json({ error: authError.message || 'Database error creating new user' }, { status: 500 });
    }

    const newUserId = newUserAuthData.user.id;

    // Determine safe legacy role
    const standardRoles = ['admin', 'super-admin', 'auditor', 'user'];
    const dbRole = standardRoles.includes(role) ? role : 'user';

    // 2. Manually insert/update profile with additional details
    const { error: profileError } = await adminClient.from('profiles').upsert({
        id: newUserId,
        email: email,
        full_name: full_name || null,
        remark: remark || null,
        role: dbRole,
        custom_role_id: custom_role_id || null,
        visible_platforms: visible_platforms !== undefined ? visible_platforms : null,
        visible_categories: visible_categories !== undefined ? visible_categories : null
    }, { onConflict: 'id' });

    if (profileError) {
        console.error('Profile upsert failed:', profileError);
        await adminClient.auth.admin.deleteUser(newUserId); // Rollback
        return NextResponse.json({ error: 'Failed to create user profile: ' + profileError.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'User created successfully', userId: newUserId }, { status: 200 });
}

export async function DELETE(req: Request) {
    if (!(await isCurrentUserAdmin())) {
        return NextResponse.json({ error: 'Unauthorized: Only administrators can perform this action.' }, { status: 403 });
    }

    const adminClient = createServerAdminClient();

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('id');

    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    try {
        // 1. Delete associated leads (must be before user_tasks)
        const { error: leadsError } = await adminClient.from('leads').delete().eq('user_id', userId);
        if (leadsError) console.error("Error deleting user's leads:", leadsError);

        // 2. Delete associated user_tasks (must be before profiles)
        const { error: userTasksError } = await adminClient.from('user_tasks').delete().eq('user_id', userId);
        if (userTasksError) console.error("Error deleting user's tasks:", userTasksError);

        // 3. Delete user's profile from public.profiles table
        const { error: profileError } = await adminClient.from('profiles').delete().eq('id', userId);
        if (profileError) throw profileError; 

        // 4. Delete user from Auth (last step)
        const { error: authError } = await adminClient.auth.admin.deleteUser(userId);
        if (authError) throw authError;

        return NextResponse.json({ message: 'User deleted successfully' }, { status: 200 });
    } catch (error) {
        console.error('Error deleting user:', error);
        return NextResponse.json({ error: getErrorMessage(error, 'Error deleting user') }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    if (!(await isCurrentUserAdmin())) {
        return NextResponse.json({ error: 'Unauthorized: Only administrators can perform this action.' }, { status: 403 });
    }

    const adminClient = createServerAdminClient();

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('id');
    const { full_name, remark, role, custom_role_id, visible_platforms, visible_categories } = await req.json();

    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    try {
        const updateData: Partial<Database['public']['Tables']['profiles']['Update']> = {};
        if (full_name !== undefined) updateData.full_name = full_name;
        if (remark !== undefined) updateData.remark = remark;
        
        if (role !== undefined) {
             const standardRoles = ['admin', 'super-admin', 'auditor', 'user'];
             updateData.role = standardRoles.includes(role) ? role : 'user';
        }
        if (custom_role_id !== undefined) updateData.custom_role_id = custom_role_id;
        
        // Save exactly what is passed, including empty array []
        if (visible_platforms !== undefined) {
            updateData.visible_platforms = visible_platforms;
        }
        if (visible_categories !== undefined) {
            updateData.visible_categories = visible_categories;
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ message: 'No data provided to update' }, { status: 200 });
        }

        const { error: profileError } = await adminClient
            .from('profiles')
            .update(updateData)
            .eq('id', userId);

        if (profileError) throw profileError;
        
        // Optionally update Auth user_metadata if full_name is changed
        const authUpdateData: { user_metadata?: { full_name?: string | null }, app_metadata?: { role?: string | null } } = {};
        if (full_name !== undefined) authUpdateData.user_metadata = { full_name: full_name };
        
        // Sync role to app_metadata so client-side checks (user.app_metadata.role) work immediately
        if (role !== undefined) authUpdateData.app_metadata = { role: role };

        if (Object.keys(authUpdateData).length > 0) {
            await adminClient.auth.admin.updateUserById(userId, authUpdateData);
        }

        return NextResponse.json({ message: 'User profile updated successfully' }, { status: 200 });
    } catch (error) {
        console.error('Error updating user profile:', error);
        return NextResponse.json({ error: getErrorMessage(error, 'Error updating user profile') }, { status: 500 });
    }
}
