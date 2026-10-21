"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
  notice?: { tone: "error" | "info" | "success"; text: string };
}) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(logIn, {});
  const alertRef = useFocusOnError(state);

  return (
    <form action={action} noValidate className="grid gap-4">
      <input type="hidden" name="next" value={next} />

      {state.error ? (
        <div ref={alertRef} tabIndex={-1} className="outline-none">
          <Notice tone="error">{state.error}</Notice>
        </div>
      ) : (
        notice && <Notice tone={notice.tone}>{notice.text}</Notice>
      )}

      <TextField
        name="email"
        label="Email"
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
        autoComplete="current-password"
        error={state.fieldErrors?.password}
        required
      />

      <Button type="submit" size="lg" className="h-11 w-full sm:h-9" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>

      <p className="text-sm text-muted-foreground">
        New to the platform?{" "}
        <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
