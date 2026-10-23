"use client";

import { VoiceAssist } from "@/components/ai-input/voice-assist";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";
import { Notice } from "@/components/auth/notice";
import { TextField } from "@/components/auth/fields";
import { useFocusOnError } from "@/components/auth/use-focus-on-error";
import { registerCompany } from "@/lib/actions/organization";
import type { CompanyFormState } from "@/lib/organization-types";
import { COMPANY_NAME_MAX, LEGAL_NAME_MAX } from "@/lib/organization-validation";

export function CompanyForm() {
  const t = useT();
  const [state, action, pending] = useActionState<CompanyFormState, FormData>(registerCompany, {});
  const alertRef = useFocusOnError(state, ["companyName", "legalName"]);

  return (
    <form action={action} noValidate className="grid gap-4">
      {state.error && (
        <div ref={alertRef} tabIndex={-1} className="outline-none">
          <Notice tone="error">{t(state.error)}</Notice>
        </div>
      )}

      <TextField
        name="companyName"
        label={t("Company or trading name")}
        autoComplete="organization"
        maxLength={COMPANY_NAME_MAX + 50}
        defaultValue={state.values?.companyName}
        hint={t("The name you trade under. You can add more company details later.")}
        error={state.fieldErrors?.companyName}
        required
      />
      <VoiceAssist compact target="text" fieldId="companyName" />
      <TextField
        name="legalName"
        label={t("Registered legal name (optional)")}
        autoComplete="off"
        maxLength={LEGAL_NAME_MAX + 50}
        defaultValue={state.values?.legalName}
        hint={t("Only if it differs from the name above, as on your business registration.")}
        error={state.fieldErrors?.legalName}
      />
      <VoiceAssist compact target="text" fieldId="legalName" />

      <Button type="submit" size="lg" className="h-11 w-full sm:h-9" disabled={pending}>
        {pending ? t("Registering…") : t("Register company")}
      </Button>
    </form>
  );
}
