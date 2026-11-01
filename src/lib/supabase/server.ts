import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ConfigError, supabaseEnv } from "./env";

/** Per-request client acting as the signed-in user (RLS enforced). */
export async function createClient(): Promise<SupabaseClient> {
  const { url, anonKey } = supabaseEnv();
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component — middleware refreshes the session instead.
        }
      },
    },
  });
}

/**
 * Service-role client for background jobs that run after the response is sent.
 * Bypasses RLS — callers MUST scope every query by the verified user_id.
 */
export function createServiceClient(): SupabaseClient {
  const { url } = supabaseEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new ConfigError("SUPABASE_SERVICE_ROLE_KEY is not set (required for background analysis).");
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Returns the signed-in user or redirects to /login. */
export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");
  return { supabase, user: data.user };
}
