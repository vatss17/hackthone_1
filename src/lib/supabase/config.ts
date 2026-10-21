import "server-only";

/**
 * Supabase connection settings for the application.
 *
 * Only the PUBLISHABLE key is used here, and only on the server: every
 * authentication call is made by Server Actions, Route Handlers and the proxy,
 * so no Supabase key is ever sent to the browser. The secret / service-role key
 * is deliberately not read anywhere in the application.
 */
export function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local and fill them in.",
    );
  }
  return { url, publishableKey };
}

/** Options for the session cookies set by this application. */
export const sessionCookieOptions = {
  // The browser never needs to read these cookies: authentication is server-side only.
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

/**
 * Public origin used in links sent by email. Taken from configuration, never from
 * request headers, so a forged Host or Origin header cannot redirect the link.
 * It must also be allowed under Authentication > URL Configuration in Supabase.
 */
export function getSiteUrl() {
  const configured = process.env.SITE_URL;
  if (configured) return configured.replace(/\/+$/, "");
  if (process.env.NODE_ENV !== "production") return "http://localhost:3000";
  throw new Error("SITE_URL must be set in production.");
}
