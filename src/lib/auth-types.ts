export type AuthFormState = {
  /** Form-level message (invalid credentials, rate limit, unexpected failure). */
  error?: string;
  /** Per-field messages, shown next to the field. */
  fieldErrors?: { email?: string; password?: string; confirmPassword?: string };
  /** Signup accepted: the user must now confirm their email address. */
  confirmationSent?: boolean;
  /** Password reset requested. Shown whether or not the address has an account. */
  resetSent?: boolean;
  /** The reset link was not valid or has expired: offer to request a new one. */
  linkExpired?: boolean;
  /** Echo of the email the user typed, so the form can show it again. Never the password. */
  email?: string;
};

export const PASSWORD_MIN = 12;
// bcrypt, used by Supabase Auth, rejects passwords longer than 72 characters.
export const PASSWORD_MAX = 72;
