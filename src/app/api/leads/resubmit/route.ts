import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { Database } from '@/lib/types';
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';
import { getSupabasePublicConfig } from '@/lib/supabase/env';
import { getErrorMessage } from '@/lib/utils';

export async function PUT(req: Request) {
    const cookieStore = await cookies();
    const { url, anon } = getSupabasePublicConfig();

    // 1. Verify Auth User
    const supabase = createServerClient<Database>(
        url,
        anon,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) {
                    cookieStore.set({ name, value, ...options });
                },
                remove(name: string, options: CookieOptions) {
                    cookieStore.set({ name, value: '', ...options });
                },
            },
        }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Service Role Client for Admin Operations
    const supabaseAdmin = createServerAdminClient();

    try {
        const body = await req.json();
        const { id, contact_info, proof_images } = body;

        if (!id) {
            return NextResponse.json({ error: 'Missing lead ID' }, { status: 400 });
        }

        // 3. Verify Ownership & Status
        const { data: lead, error: fetchError } = await supabaseAdmin
            .from('leads')
            .select('user_id, status')
            .eq('id', id)
            .single();

        if (fetchError || !lead) {
            return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
        }

        if (lead.user_id !== user.id) {
            return NextResponse.json({ error: 'Forbidden: You do not own this lead' }, { status: 403 });
        }

        if (lead.status !== 'rejected') {
            return NextResponse.json({ error: 'Only rejected leads can be resubmitted' }, { status: 400 });
        }

        // 4. Perform Update
        const { error: updateError } = await supabaseAdmin
            .from('leads')
            .update({
                contact_info,
                proof_images,
                status: 'pending',
                review_note: null,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (updateError) throw updateError;

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Resubmit error:', error);
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}
