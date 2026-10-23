import type { AuthFormState } from "./auth-types";

/** The parts of a Supabase AuthError this mapping reads. */
export type AuthErrorLike = { code?: string | null; status?: number | null; message?: string | null };

const isRateLimit = (e: AuthErrorLike) =>
  e.status === 429 ||
  e.code === "over_request_rate_limit" ||
  e.code === "over_email_send_rate_limit" ||
  e.code === "over_sms_send_rate_limit";

/** The confirmation email could not be sent (sender restrictions, SMTP failure). */
const isDeliveryFailure = (e: AuthErrorLike) =>
  e.code === "email_address_not_authorized" ||
  e.code === "smtp_failed" ||
  /error sending (confirmation|signup) email|failed to send|smtp/i.test(e.message ?? "");

/**
 * Sign-in failures. One message for an unknown email and a wrong password, so the
 * form cannot be used to discover which accounts exist.
 */
export function mapLogInError(error: AuthErrorLike, email: string): AuthFormState {
  if (error.code === "email_not_confirmed") {
    return {
      email,
      error: "Your email address is not confirmed yet. Open the confirmation link we emailed you, then sign in.",
    };
  }
  if (isRateLimit(error)) return { email, error: "Too many attempts. Wait a minute and try again." };
  if (error.code === "invalid_credentials") return { email, error: "The email or password is incorrect." };
  return { email, error: "We could not sign you in right now. Try again in a moment." };
}

/**
 * Sign-up failures. Whenever Supabase reports that the account could not be created
 * or the confirmation email could not be sent, the user is told so plainly. The
 * "Check your email" panel is only ever produced when Supabase accepted the request
 * (see signUp), never as a fallback.
 *
 * None of these messages depends on whether the address already has an account:
 * Supabase answers an existing address the same way as a new one.
 */
export function mapSignUpError(error: AuthErrorLike, email: string): AuthFormState {
  if (error.code === "weak_password") {
    return { email, fieldErrors: { password: "That password is too easy to guess. Choose a longer or less common one." } };
  }
  if (error.code === "email_address_invalid") {
    return { email, fieldErrors: { email: "Enter a valid email address." } };
  }
  if (isRateLimit(error)) {
    return {
      email,
      error:
        "No confirmation email was sent: too many sign-up emails were requested. Wait a few minutes and try again.",
    };
  }
  if (isDeliveryFailure(error)) {
    return {
      email,
      error:
        "No confirmation email was sent: the email service could not deliver to this address right now. Try again later or contact support.",
    };
  }
  return { email, error: "We could not create your account right now. Try again in a moment." };
}

/**
 * Password-reset request failures. Whether the address has an account is NEVER revealed: an unknown address gets exactly the same
 * response as a known one. Only problems that do not depend on the address (rate limit, email delivery) are reported.
 */
export function mapResetRequestError(error: AuthErrorLike | null, email: string): AuthFormState {
  if (!error) return { email, resetSent: true };
  if (isRateLimit(error)) return { email, error: "Too many reset emails were requested. Wait a few minutes and try again." };
  if (isDeliveryFailure(error)) return { email, error: "No email was sent: the email service could not deliver right now. Try again later or contact support." };
  if (error.code === "email_address_invalid") return { email, fieldErrors: { email: "Enter a valid email address." } };
  return { email, error: "We could not start the reset right now. Try again in a moment." };
}

/** Setting a new password after a reset link. */
export function mapUpdatePasswordError(error: AuthErrorLike): AuthFormState {
  if (error.code === "weak_password") return { fieldErrors: { password: "That password is too easy to guess. Choose a longer or less common one." } };
  if (error.code === "same_password") return { fieldErrors: { password: "Choose a password you have not used before on this account." } };
  if (isRateLimit(error)) return { error: "Too many attempts. Wait a minute and try again." };
  if (error.code === "session_not_found" || error.code === "reauthentication_needed" || error.status === 401 || error.status === 403) return { error: "This reset link is no longer valid. Request a new one.", linkExpired: true };
  return { error: "We could not change your password right now. Try again in a moment." };
}
