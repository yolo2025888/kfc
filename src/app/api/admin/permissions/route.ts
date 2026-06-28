import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';
import { NextResponse } from 'next/server';
import { isCurrentUserAdmin } from '@/lib/auth/admin';
import { getErrorMessage } from '@/lib/utils';

export async function GET() {
  try {
    if (!(await isCurrentUserAdmin())) {
      return NextResponse.json(
        { error: 'Unauthorized: Only administrators can perform this action.' },
        { status: 403 }
      );
    }

    const supabase = createServerAdminClient();
    
    // Fetch all permissions, ordered by sort_order
    const { data, error } = await supabase
      .from('app_permissions')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
