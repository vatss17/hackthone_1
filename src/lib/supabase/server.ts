import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseConfig, sessionCookieOptions } from "./config";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Runs as the signed-in user (publishable key + the user's session cookie), so
 * every query is subject to the same grants and Row Level Security as any API
 * client.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabaseConfig();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, { ...options, ...sessionCookieOptions }),
          );
        } catch {
          // Called from a Server Component, which cannot set cookies. Safe to ignore:
          // the proxy refreshes the session on every request.
        }
      },
    },
  });
}
