/**
 * Is this session the result of a password-recovery link that was opened a moment ago?
 *
 * The reset page changes a password WITHOUT asking for the old one, so it must only work right after a recovery link, never for an ordinary
 * signed-in session (which would let anyone using an unlocked browser change the password). The check reads the session's authentication
 * methods ("amr") from the claims the Auth server signed. A session that was started by a password sign-in is refused.
 */

export const RECOVERY_WINDOW_SECONDS = 15 * 60;

type Amr = { method?: unknown; timestamp?: unknown };
export type Claims = { amr?: unknown; iat?: unknown };

const RECOVERY_METHODS = new Set(["recovery", "otp", "magiclink", "email/signup", "email_change"]);

export function isRecentRecoverySession(claims: Claims | null | undefined, nowSeconds: number = Math.floor(Date.now() / 1000)): boolean {
  if (!claims || !Array.isArray(claims.amr)) return false;
  const entries = (claims.amr as Amr[]).filter((a) => a && typeof a === "object");
  const recent = entries.filter((a) => typeof a.timestamp === "number" && nowSeconds - (a.timestamp as number) <= RECOVERY_WINDOW_SECONDS && (a.timestamp as number) <= nowSeconds + 60);
  const viaLink = recent.some((a) => typeof a.method === "string" && RECOVERY_METHODS.has(a.method));
  const viaPassword = recent.some((a) => a.method === "password");
  return viaLink && !viaPassword;
}
