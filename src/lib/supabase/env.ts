import { getCloudflareContext } from '@opennextjs/cloudflare';

type SupabaseEnv = {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  PRIVATE_SUPABASE_SERVICE_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

function getRuntimeEnv(): SupabaseEnv {
  try {
    return getCloudflareContext({ async: false }).env as SupabaseEnv;
  } catch {
    return {};
  }
}

function nonEmpty(value: string | undefined) {
  const normalized = value?.trim();
  return normalized || undefined;
}

export function getSupabasePublicConfig() {
  const runtimeEnv = getRuntimeEnv();
  const url = nonEmpty(runtimeEnv.NEXT_PUBLIC_SUPABASE_URL) ?? nonEmpty(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anon = nonEmpty(runtimeEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY) ?? nonEmpty(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!url || !anon) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  return { url, anon };
}

export function getSupabaseAdminConfig() {
  const runtimeEnv = getRuntimeEnv();
  const { url } = getSupabasePublicConfig();
  const serviceRoleKey =
    nonEmpty(runtimeEnv.PRIVATE_SUPABASE_SERVICE_KEY) ??
    nonEmpty(runtimeEnv.SUPABASE_SERVICE_ROLE_KEY) ??
    nonEmpty(process.env.PRIVATE_SUPABASE_SERVICE_KEY) ??
    nonEmpty(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!serviceRoleKey) {
    throw new Error('Missing PRIVATE_SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY');
  }

  return { url, serviceRoleKey };
}
