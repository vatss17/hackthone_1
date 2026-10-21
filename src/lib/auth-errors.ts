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
