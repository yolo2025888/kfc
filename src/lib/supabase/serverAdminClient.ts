import { createClient } from '@supabase/supabase-js';
import { Database } from '../types'; // Adjust path if needed
import { getSupabaseAdminConfig } from './env';

// Note: This client uses the `service_role` key and has full bypass privileges.
// Only use on the server side (API routes, server components/actions)
// and ensure it's protected by appropriate authentication/authorization checks.
export function createServerAdminClient() {
  const { url, serviceRoleKey } = getSupabaseAdminConfig();

  return createClient<Database>(
    url,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
      },
    }
  );
}
