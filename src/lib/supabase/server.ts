import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import {cookies} from 'next/headers'
import {ClientType, SassClient} from "@/lib/supabase/unified";
import {Database} from "@/lib/types";
import { getSupabasePublicConfig } from "@/lib/supabase/env";

export async function createSSRClient() {
    const cookieStore = await cookies()
    const { url, anon } = getSupabasePublicConfig();

    return createServerClient<Database, "public">(
        url,
        anon,
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
    const { url, anon } = getSupabasePublicConfig();
    return createClient<Database>(url, anon, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
        global: { fetch },
    });
}
