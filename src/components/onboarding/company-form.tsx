"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/auth/notice";
import { TextField } from "@/components/auth/fields";
import { useFocusOnError } from "@/components/auth/use-focus-on-error";
import { registerCompany } from "@/lib/actions/organization";
import type { CompanyFormState } from "@/lib/organization-types";
import { COMPANY_NAME_MAX, LEGAL_NAME_MAX } from "@/lib/organization-validation";

export function CompanyForm() {
  const [state, action, pending] = useActionState<CompanyFormState, FormData>(registerCompany, {});
  const alertRef = useFocusOnError(state, ["companyName", "legalName"]);

  return (
    <form action={action} noValidate className="grid gap-4">
      {state.error && (
        <div ref={alertRef} tabIndex={-1} className="outline-none">
          <Notice tone="error">{state.error}</Notice>
        </div>
      )}

      <TextField
        name="companyName"
        label="Company or trading name"
        autoComplete="organization"
        maxLength={COMPANY_NAME_MAX + 50}
        defaultValue={state.values?.companyName}
        hint="The name you trade under. You can add more company details later."
        error={state.fieldErrors?.companyName}
        required
      />
      <TextField
        name="legalName"
        label="Registered legal name (optional)"
        autoComplete="off"
        maxLength={LEGAL_NAME_MAX + 50}
        defaultValue={state.values?.legalName}
        hint="Only if it differs from the name above, as on your business registration."
        error={state.fieldErrors?.legalName}
      />

      <Button type="submit" size="lg" className="h-11 w-full sm:h-9" disabled={pending}>
        {pending ? "Registering…" : "Register company"}
      </Button>
    </form>
  );
}
