import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';
import { NextResponse } from 'next/server';
import { isCurrentUserAdmin } from '@/lib/auth/admin';
import { getErrorMessage } from '@/lib/utils';

export const runtime = 'edge';

export async function PUT(req: Request) {
    if (!(await isCurrentUserAdmin())) {
        return NextResponse.json({ error: 'Unauthorized: Only administrators can perform this action.' }, { status: 403 });
    }

    const { taskId, status } = await req.json();

    if (!taskId || !status) {
        return NextResponse.json({ error: 'Task ID and status are required' }, { status: 400 });
    }

    const adminClient = createServerAdminClient();

    try {
        // 1. Update the main task status
        const { error: taskError } = await adminClient
            .from('tasks')
            .update({ status })
            .eq('id', taskId);

        if (taskError) throw taskError;

        // 2. If closing, also physically DELETE all associated user_tasks and leads
        if (status === 'closed') {
            // First, get all user_task IDs to delete associated leads
            const { data: utRecords } = await adminClient
                .from('user_tasks')
                .select('id')
                .eq('task_id', taskId);

            if (utRecords && utRecords.length > 0) {
                const utIds = utRecords.map(r => r.id);
                
                // Delete leads first (foreign key dependency)
                await adminClient
                    .from('leads')
                    .delete()
                    .in('user_task_id', utIds);

                // Then delete user_tasks
                await adminClient
                    .from('user_tasks')
                    .delete()
                    .eq('task_id', taskId);
            }
        }

        return NextResponse.json({ message: 'Task status updated successfully' }, { status: 200 });

    } catch (error) {
        console.error('Error updating task status:', error);
        return NextResponse.json({ error: getErrorMessage(error, 'Error updating task status') }, { status: 500 });
    }
}
