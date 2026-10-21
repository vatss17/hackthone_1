"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/auth/notice";
import { PasswordField, TextField } from "@/components/auth/fields";
import { useFocusOnError } from "@/components/auth/use-focus-on-error";
import { signUp } from "@/lib/actions/auth";
import { PASSWORD_MIN, type AuthFormState } from "@/lib/auth-types";

export function SignupForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signUp, {});
  const alertRef = useFocusOnError(state);

  if (state.confirmationSent) {
    return (
      <div className="grid gap-4" role="status">
        <h2 className="text-base font-semibold">Check your email</h2>
        <p className="text-sm text-muted-foreground">
          We sent a confirmation link to <span className="font-medium text-foreground">{state.email}</span>. Open it to
          activate your account, then sign in.
        </p>
        <p className="text-sm text-muted-foreground">
          The link works once and expires after a short time. If nothing arrives in a few minutes, check your spam folder
          or sign up again with the same address.
        </p>
        <Link href="/login" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="grid gap-4">
      {state.error && (
        <div ref={alertRef} tabIndex={-1} className="outline-none">
          <Notice tone="error">{state.error}</Notice>
        </div>
      )}

      <TextField
        name="email"
        label="Work email"
        type="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        inputMode="email"
        defaultValue={state.email}
        error={state.fieldErrors?.email}
        required
      />
      <PasswordField
        name="password"
        label="Password"
        autoComplete="new-password"
        hint={`At least ${PASSWORD_MIN} characters.`}
        error={state.fieldErrors?.password}
        required
      />
      <PasswordField
        name="confirmPassword"
        label="Confirm password"
        autoComplete="new-password"
        error={state.fieldErrors?.confirmPassword}
        required
      />

      <Button type="submit" size="lg" className="h-11 w-full sm:h-9" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
