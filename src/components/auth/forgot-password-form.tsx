"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";
import { Notice } from "@/components/auth/notice";
import { TextField } from "@/components/auth/fields";
import { useFocusOnError } from "@/components/auth/use-focus-on-error";
import { requestPasswordReset } from "@/lib/actions/auth";
import type { AuthFormState } from "@/lib/auth-types";

export function ForgotPasswordForm() {
  const t = useT();
  const [state, action, pending] = useActionState<AuthFormState, FormData>(requestPasswordReset, {});
  const alertRef = useFocusOnError(state);

  if (state.resetSent) {
    return (
      <div className="grid gap-4" role="status">
        <h2 className="text-base font-semibold">{t("Check your email")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("If an account exists for {email}, we have sent a link to choose a new password. The link works once and expires after a short time.", { email: "\u0000" }).split("\u0000").flatMap((part, i) => (i === 0 ? [part] : [<span key="e" className="font-medium text-foreground">{state.email}</span>, part]))}
        </p>
        <p className="text-sm text-muted-foreground">{t("Nothing arrived after a few minutes? Check your spam folder, or request another link.")}</p>
        <Link href="/login" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          {t("Back to sign in")}
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
      <TextField name="email" label={t("Email")} type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} inputMode="email" defaultValue={state.email} error={state.fieldErrors?.email} required />
      <Button type="submit" size="lg" className="h-11 w-full sm:h-9" disabled={pending}>
        {pending ? t("Sending…") : t("Send the reset link")}
      </Button>
      <Link href="/login" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
        {t("Back to sign in")}
      </Link>
    </form>
  );
}
