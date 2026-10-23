"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/auth/notice";
import { SelectField, TextField } from "@/components/auth/fields";
import { useFocusOnError } from "@/components/auth/use-focus-on-error";
import { ADDRESS_MAX, CITY_MAX, FACTORY_NAME_MAX, INDIAN_STATES } from "@/lib/factory-validation";
import type { FactoryFormState, FactoryFormValues } from "@/lib/factory-types";

const ORDER = ["factoryName", "addressLine1", "addressLine2", "city", "state", "postalCode"];

/** Shared by "add" and "edit": pass the matching Server Action, and `id` when editing. */
export function FactoryForm({
  action,
  initial,
  id,
  submitLabel,
  pendingLabel,
  cancelHref,
}: {
  action: (prev: FactoryFormState, formData: FormData) => Promise<FactoryFormState>;
  initial?: FactoryFormValues;
  id?: string;
  submitLabel: string;
  pendingLabel: string;
  cancelHref: string;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState<FactoryFormState, FormData>(action, {});
  const alertRef = useFocusOnError(state, ORDER);
  const v = state.values ?? initial;
  const e = state.fieldErrors ?? {};

  return (
    <form action={formAction} noValidate className="grid gap-4">
      {id && <input type="hidden" name="id" value={id} />}
      {state.error && (
        <div ref={alertRef} tabIndex={-1} className="outline-none">
          <Notice tone="error">{t(state.error)}</Notice>
        </div>
      )}

      <TextField
        name="factoryName"
        label={t("Factory name")}
        autoComplete="off"
        maxLength={FACTORY_NAME_MAX + 50}
        defaultValue={v?.factoryName}
        hint={t("How you refer to this site, for example the plant or unit name.")}
        error={e.factoryName ? t(e.factoryName) : undefined}
        required
      />
      <TextField
        name="addressLine1"
        label={t("Address line 1")}
        autoComplete="off"
        maxLength={ADDRESS_MAX + 50}
        defaultValue={v?.addressLine1}
        error={e.addressLine1 ? t(e.addressLine1) : undefined}
        required
      />
      <TextField
        name="addressLine2"
        label={t("Address line 2 (optional)")}
        autoComplete="off"
        maxLength={ADDRESS_MAX + 50}
        defaultValue={v?.addressLine2}
        error={e.addressLine2 ? t(e.addressLine2) : undefined}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="city"
          label={t("City")}
          autoComplete="off"
          maxLength={CITY_MAX + 50}
          defaultValue={v?.city}
          error={e.city ? t(e.city) : undefined}
          required
        />
        <SelectField
          name="state"
          label={t("State or union territory")}
          options={INDIAN_STATES}
          placeholder={t("Choose…")}
          defaultValue={v?.state ?? ""}
          error={e.state ? t(e.state) : undefined}
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="postalCode"
          label={t("PIN code")}
          inputMode="numeric"
          autoComplete="off"
          maxLength={12}
          defaultValue={v?.postalCode}
          hint={t("6 digits.")}
          error={e.postalCode ? t(e.postalCode) : undefined}
          required
        />
        <div className="grid gap-1.5">
          <span className="text-sm font-medium leading-none">{t("Country")}</span>
          <div className="flex h-11 items-center rounded-md border border-border bg-muted px-3 text-base text-muted-foreground md:h-10 md:text-sm">
            {t("India")}
          </div>
          <p className="text-xs text-muted-foreground">{t("Fixed for now: the platform supports Indian factories only.")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 pt-1 sm:flex-row-reverse sm:justify-start">
        <Button type="submit" size="lg" className="h-11 sm:h-9" disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
        <Button asChild variant="outline" size="lg" className="h-11 sm:h-9">
          <Link href={cancelHref}>{t("Cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}
