"use client";

import { useEffect, useRef } from "react";

type FocusState = { error?: string; fieldErrors?: Record<string, string | undefined> };

/**
 * After a submission fails, move focus to the first invalid field, or to the
 * form-level message, so keyboard and screen-reader users land on the problem.
 * Field ids are the field names.
 */
export function useFocusOnError(state: FocusState, fieldOrder: string[] = ["email", "password", "confirmPassword"]) {
  const alertRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const first = fieldOrder.find((f) => state.fieldErrors?.[f]);
    if (first) {
      document.getElementById(first)?.focus();
    } else if (state.error) {
      alertRef.current?.focus();
    }
    // fieldOrder is a constant per form
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return alertRef;
}
