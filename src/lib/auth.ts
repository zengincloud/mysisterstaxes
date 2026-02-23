import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || "";

/**
 * Get the effective userId for the current request.
 * If the caller is the super admin and has an impersonation cookie set,
 * returns the impersonated user's ID instead.
 */
export async function getUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Super admin impersonation
  if (SUPER_ADMIN_EMAIL && user.email === SUPER_ADMIN_EMAIL) {
    const cookieStore = await cookies();
    const impersonated = cookieStore.get("x-impersonate-user-id")?.value;
    if (impersonated) return impersonated;
  }

  return user.id;
}

/**
 * Check if the current user is the super admin.
 */
export async function isSuperAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  return SUPER_ADMIN_EMAIL !== "" && user.email === SUPER_ADMIN_EMAIL;
}

/**
 * Get the real authenticated user ID (ignoring impersonation).
 */
export async function getRealUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id || null;
}
