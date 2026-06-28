import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';
import { NextResponse } from 'next/server';
import { isCurrentUserAdmin } from '@/lib/auth/admin';
import { getErrorMessage } from '@/lib/utils';

export async function PUT(req: Request) {
    // Admin Authentication Check
    if (!(await isCurrentUserAdmin())) {
        return NextResponse.json({ error: 'Unauthorized: Only administrators can perform this action.' }, { status: 403 });
    }

    const adminClient = createServerAdminClient();

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('id');
    const { newPassword } = await req.json();

    if (!userId || !newPassword) {
        return NextResponse.json({ error: 'User ID and new password are required' }, { status: 400 });
    }

    try {
        const { error: authError } = await adminClient.auth.admin.updateUserById(userId, { password: newPassword });
        if (authError) throw authError;

        return NextResponse.json({ message: 'User password updated successfully' }, { status: 200 });
    } catch (error) {
        console.error('Error updating user password:', error);
        return NextResponse.json({ error: getErrorMessage(error, 'Error updating user password') }, { status: 500 });
    }
}
