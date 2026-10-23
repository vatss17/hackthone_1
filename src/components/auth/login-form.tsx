"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";
import { Notice } from "@/components/auth/notice";
import { PasswordField, TextField } from "@/components/auth/fields";
import { useFocusOnError } from "@/components/auth/use-focus-on-error";
import { logIn } from "@/lib/actions/auth";
import type { AuthFormState } from "@/lib/auth-types";

export function LoginForm({
  next,
  notice,
}: {
  next: string;
  notice?: { tone: "error" | "info" | "success"; id: string };
}) {
  const t = useT();
  const [state, action, pending] = useActionState<AuthFormState, FormData>(logIn, {});
  const alertRef = useFocusOnError(state);
  const NOTICE_TEXT: Record<string, string> = {
    confirmation_failed: t("That confirmation link is invalid or has expired. Sign up again with the same email to receive a new one."),
    session_expired: t("Your session has expired. Sign in again to continue."),
    signed_out: t("You have been signed out."),
    password_updated: t("Your password was changed. Sign in with the new one."),
    reset_failed: t("That reset link is invalid or has expired. Request a new one."),
  };

  return (
    <form action={action} noValidate className="grid gap-4">
      <input type="hidden" name="next" value={next} />

      {state.error ? (
        <div ref={alertRef} tabIndex={-1} className="outline-none">
          <Notice tone="error">{t(state.error)}</Notice>
        </div>
      ) : (
        notice && NOTICE_TEXT[notice.id] && <Notice tone={notice.tone}>{NOTICE_TEXT[notice.id]}</Notice>
      )}

      <TextField
        name="email"
        label={t("Email")}
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
        autoComplete="current-password"
        error={state.fieldErrors?.password}
        required
      />

      <Button type="submit" size="lg" className="h-11 w-full sm:h-9" disabled={pending}>
        {pending ? t("Signing in…") : t("Sign in")}
      </Button>

      <p className="text-sm">
        <Link href="/forgot-password" className="font-medium text-primary underline-offset-4 hover:underline">
          {t("Forgot your password?")}
        </Link>
      </p>

      <p className="text-sm text-muted-foreground">
        {t("New to the platform?")}{" "}
        <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
          {t("Create an account")}
        </Link>
      </p>
    </form>
  );
}
