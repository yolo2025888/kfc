import { createClient } from '@supabase/supabase-js';
import { Database } from '../types'; // Adjust path if needed

// Note: This client uses the `service_role` key and has full bypass privileges.
// Only use on the server side (API routes, server components/actions)
// and ensure it's protected by appropriate authentication/authorization checks.
export function createServerAdminClient() {
  const serviceRoleKey =
    process.env.PRIVATE_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error('Missing PRIVATE_SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
      },
    }
  );
}
