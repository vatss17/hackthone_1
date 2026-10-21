import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-redirect";

// Only the email-confirmation link types this app sends. Password recovery and
// invitations will get their own handlers when those features exist.
const ALLOWED_TYPES: EmailOtpType[] = ["signup", "email"];

/**
 * Email confirmation endpoint (linked from the Supabase confirmation email).
 *
 * Supports both link styles:
 *  - token_hash + type: works on any device, used by the recommended email template
 *  - code: the PKCE flow, works when the link is opened in the browser that signed up
 *
 * Success starts a session and goes to the dashboard. Any failure goes to the
 * sign-in page with a fixed message code (nothing from the link is reflected).
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const code = params.get("code");
  const next = safeNextPath(params.get("next"));

  const supabase = await createClient();
  let failed = true;

  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    failed = Boolean(error);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    failed = Boolean(error);
  }

  if (failed) redirect("/login?error=confirmation_failed");
  redirect(next);
}
