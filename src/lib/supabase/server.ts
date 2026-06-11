import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import {cookies} from 'next/headers'
import {ClientType, SassClient} from "@/lib/supabase/unified";
import {Database} from "@/lib/types";

export async function createSSRClient() {
    const cookieStore = await cookies()

    return createServerClient<Database, "public">(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            }
        }
    )
}



export async function createSSRSassClient() {
    const client = await createSSRClient();
    // This must be some bug that SupabaseClient is not properly recognized, so must be ignored
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new SassClient(client as any, ClientType.SERVER);
}

// Anonymous, cookie-less server client for read-only access (Edge/RSC friendly)
export function createServerAnonClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
    if (!url || !anon) {
        throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
    }
    return createClient<Database>(url, anon, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
        global: { fetch },
    });
}
