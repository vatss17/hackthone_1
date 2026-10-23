"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";
import { Notice } from "@/components/auth/notice";
import { PasswordField, TextField } from "@/components/auth/fields";
import { useFocusOnError } from "@/components/auth/use-focus-on-error";
import { signUp } from "@/lib/actions/auth";
import { PASSWORD_MIN, type AuthFormState } from "@/lib/auth-types";

export function SignupForm() {
  const t = useT();
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signUp, {});
  const alertRef = useFocusOnError(state);

  if (state.confirmationSent) {
    return (
      <div className="grid gap-4" role="status">
        <h2 className="text-base font-semibold">{t("Check your email")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("We sent a confirmation link to {email}. Open it to activate your account, then sign in.", { email: "\u0000" }).split("\u0000").flatMap((part, i) => (i === 0 ? [part] : [<span key="e" className="font-medium text-foreground">{state.email}</span>, part]))}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("The link works once and expires after a short time. If nothing arrives in a few minutes, check your spam folder or sign up again with the same address.")}
        </p>
        <Link href="/login" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          {t("Go to sign in")}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="grid gap-4">
      {state.error && (
        <div ref={alertRef} tabIndex={-1} className="outline-none">
          <Notice tone="error">{t(state.error)}</Notice>
        </div>
      )}

      <TextField
        name="email"
        label={t("Work email")}
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
        label={t("Password")}
        autoComplete="new-password"
        hint={t("At least {min} characters.", { min: PASSWORD_MIN })}
        error={state.fieldErrors?.password}
        required
      />
      <PasswordField
        name="confirmPassword"
        label={t("Confirm password")}
        autoComplete="new-password"
        error={state.fieldErrors?.confirmPassword}
        required
      />

      <Button type="submit" size="lg" className="h-11 w-full sm:h-9" disabled={pending}>
        {pending ? t("Creating account…") : t("Create account")}
      </Button>

      <p className="text-sm text-muted-foreground">
        {t("Already have an account?")}{" "}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          {t("Sign in")}
        </Link>
      </p>
    </form>
  );
}
