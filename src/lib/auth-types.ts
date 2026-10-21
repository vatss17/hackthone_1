export type AuthFormState = {
  /** Form-level message (invalid credentials, rate limit, unexpected failure). */
  error?: string;
  /** Per-field messages, shown next to the field. */
  fieldErrors?: { email?: string; password?: string; confirmPassword?: string };
  /** Signup accepted: the user must now confirm their email address. */
  confirmationSent?: boolean;
  /** Echo of the email the user typed, so the form can show it again. Never the password. */
  email?: string;
};

export const PASSWORD_MIN = 12;
// bcrypt, used by Supabase Auth, rejects passwords longer than 72 characters.
export const PASSWORD_MAX = 72;
