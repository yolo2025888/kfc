import { createSSRClient } from "@/lib/supabase/server";

const ADMIN_ROLE_CODES = new Set(["admin", "super-admin", "super_admin"]);

type AdminProfile = {
  role: string | null;
  custom_role_id: string | null;
};

type AppRole = {
  code: string | null;
};

export async function isCurrentUserAdmin(): Promise<boolean> {
  const supabase = await createSSRClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return false;
  }

  const { data: profileResult, error: profileError } = await supabase
    .from("profiles")
    .select("role, custom_role_id")
    .eq("id", user.id)
    .maybeSingle();
  const profile = profileResult as AdminProfile | null;

  if (profileError || !profile) {
    return false;
  }

  if (profile.role && ADMIN_ROLE_CODES.has(profile.role)) {
    return true;
  }

  if (!profile.custom_role_id) {
    return false;
  }

  const { data: roleResult, error: roleError } = await supabase
    .from("app_roles")
    .select("code")
    .eq("id", profile.custom_role_id)
    .maybeSingle();
  const role = roleResult as AppRole | null;

  return !roleError && !!role?.code && ADMIN_ROLE_CODES.has(role.code);
}
