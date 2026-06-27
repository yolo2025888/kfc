import {createBrowserClient} from '@supabase/ssr'
import {ClientType, SassClient} from "@/lib/supabase/unified";
import {Database} from "@/lib/types";

export const missingSupabaseConfigMessage =
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Create .env.local from .env.example and fill in your Supabase project values.';

export function hasSupabaseBrowserConfig() {
    return Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
}

export function createSPAClient() {
    if (!hasSupabaseBrowserConfig()) {
        throw new Error(missingSupabaseConfigMessage);
    }

    return createBrowserClient<Database, "public">(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
}

export async function createSPASassClient() {
    const client = createSPAClient();
    // This must be some bug that SupabaseClient is not properly recognized, so must be ignored
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new SassClient(client as any, ClientType.SPA);
}

export async function createSPASassClientAuthenticated() {
    const client = createSPAClient();
    const user = await client.auth.getSession();
    if (!user.data || !user.data.session) {
        window.location.href = '/auth/login';
    }
    // This must be some bug that SupabaseClient is not properly recognized, so must be ignored
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new SassClient(client as any, ClientType.SPA);
}
