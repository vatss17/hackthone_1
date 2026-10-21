"use client";

import { useEffect, useRef } from "react";
import type { AuthFormState } from "@/lib/auth-types";

/**
 * After a submission fails, move focus to the first invalid field, or to the
 * form-level message, so keyboard and screen-reader users land on the problem.
 */
export function useFocusOnError(state: AuthFormState) {
  const alertRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const first = (["email", "password", "confirmPassword"] as const).find((f) => state.fieldErrors?.[f]);
    if (first) {
      document.getElementById(first === "confirmPassword" ? "confirmPassword" : first)?.focus();
    } else if (state.error) {
      alertRef.current?.focus();
    }
  }, [state]);
  return alertRef;
}
