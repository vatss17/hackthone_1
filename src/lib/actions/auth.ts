"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/supabase/config";
import { safeNextPath } from "@/lib/safe-redirect";
import { mapLogInError, mapResetRequestError, mapSignUpError, mapUpdatePasswordError } from "@/lib/auth-errors";
import { isRecentRecoverySession } from "@/lib/recovery";
import { PASSWORD_MAX, PASSWORD_MIN, type AuthFormState } from "@/lib/auth-types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readEmail(formData: FormData) {
  return String(formData.get("email") ?? "").trim().toLowerCase();
}

function emailError(email: string) {
  if (!email) return "Enter your email address.";
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return "Enter a valid email address.";
  return undefined;
}

/**
 * Sign in with email and password. The identity of the user is decided by Supabase
 * Auth. Nothing here accepts a role, an organization or any other privilege.
 */
export async function logIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = readEmail(formData);
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));

  const fieldErrors: AuthFormState["fieldErrors"] = {};
  const eErr = emailError(email);
  if (eErr) fieldErrors.email = eErr;
  if (!password) fieldErrors.password = "Enter your password.";
  if (fieldErrors.email || fieldErrors.password) return { fieldErrors, email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return mapLogInError(error, email);

  redirect(next); // outside any try/catch: redirect() works by throwing
}

/**
 * Create an account. The request carries only an email address and a password:
 * there is no way to ask for a role, and no user metadata is sent. Supabase sends a
 * confirmation email and the account cannot sign in until it is confirmed.
 */
export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = readEmail(formData);
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const fieldErrors: NonNullable<AuthFormState["fieldErrors"]> = {};
  const eErr = emailError(email);
  if (eErr) fieldErrors.email = eErr;
  if (password.length < PASSWORD_MIN) {
    fieldErrors.password = `Use at least ${PASSWORD_MIN} characters.`;
  } else if (password.length > PASSWORD_MAX) {
    fieldErrors.password = `Use at most ${PASSWORD_MAX} characters.`;
  }
  if (!fieldErrors.password && confirmPassword !== password) {
    fieldErrors.confirmPassword = "The passwords do not match.";
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors, email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${getSiteUrl()}/auth/confirm` },
  });

  if (error) return mapSignUpError(error, email);

  // Same response whether the address is new or already registered, so the form
  // cannot be used to discover which emails have accounts.
  return { email, confirmationSent: true };
}

/** End this device's session and return to the sign-in page. */
export async function logOut() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login?notice=signed_out");
}

/**
 * Start a password reset. The response is the same whether or not the address has an account. The email link goes to /auth/confirm, which
 * starts a short recovery session and sends the person to /reset-password. The site URL comes from configuration, never from request headers.
 */
export async function requestPasswordReset(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = readEmail(formData);
  const eErr = emailError(email);
  if (eErr) return { fieldErrors: { email: eErr }, email };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${getSiteUrl()}/auth/confirm?next=/reset-password` });
  return mapResetRequestError(error, email);
}

/**
 * Set a new password from a recovery session. Refused unless the session came from a recovery link a moment ago. On success every other
 * session is ended, this one is ended too, and the person signs in again with the new password.
 */
export async function updatePassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const fieldErrors: NonNullable<AuthFormState["fieldErrors"]> = {};
  if (password.length < PASSWORD_MIN) fieldErrors.password = `Use at least ${PASSWORD_MIN} characters.`;
  else if (password.length > PASSWORD_MAX) fieldErrors.password = `Use at most ${PASSWORD_MAX} characters.`;
  else if (confirmPassword !== password) fieldErrors.confirmPassword = "The passwords do not match.";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!isRecentRecoverySession(data?.claims as { amr?: unknown } | undefined)) return { error: "This page only works right after you open the link in a password-reset email. Request a new link.", linkExpired: true };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return mapUpdatePasswordError(error);
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login?notice=password_updated");
}
