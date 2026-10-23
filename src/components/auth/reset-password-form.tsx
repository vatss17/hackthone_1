"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";
import { Notice } from "@/components/auth/notice";
import { PasswordField } from "@/components/auth/fields";
import { useFocusOnError } from "@/components/auth/use-focus-on-error";
import { updatePassword } from "@/lib/actions/auth";
import { PASSWORD_MIN, type AuthFormState } from "@/lib/auth-types";

export function ResetPasswordForm() {
  const t = useT();
  const [state, action, pending] = useActionState<AuthFormState, FormData>(updatePassword, {});
  const alertRef = useFocusOnError(state);
  return (
    <form action={action} noValidate className="grid gap-4">
      {state.error && (
        <div ref={alertRef} tabIndex={-1} className="outline-none">
          <Notice tone="error">{t(state.error)}</Notice>
          {state.linkExpired && (
            <p className="mt-2 text-sm">
              <Link href="/forgot-password" className="font-medium text-primary underline-offset-4 hover:underline">
                {t("Request a new reset link")}
              </Link>
            </p>
          )}
        </div>
      )}
      <PasswordField name="password" label={t("New password")} autoComplete="new-password" hint={t("At least {min} characters.", { min: PASSWORD_MIN })} error={state.fieldErrors?.password} required />
      <PasswordField name="confirmPassword" label={t("Confirm new password")} autoComplete="new-password" error={state.fieldErrors?.confirmPassword} required />
      <Button type="submit" size="lg" className="h-11 w-full sm:h-9" disabled={pending}>
        {pending ? t("Saving…") : t("Save the new password")}
      </Button>
    </form>
  );
}
