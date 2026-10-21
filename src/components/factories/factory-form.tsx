"use client";

import { useActionState } from "react";
import Link from "next/link";
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
  const [state, formAction, pending] = useActionState<FactoryFormState, FormData>(action, {});
  const alertRef = useFocusOnError(state, ORDER);
  const v = state.values ?? initial;
  const e = state.fieldErrors ?? {};

  return (
    <form action={formAction} noValidate className="grid gap-4">
      {id && <input type="hidden" name="id" value={id} />}
      {state.error && (
        <div ref={alertRef} tabIndex={-1} className="outline-none">
          <Notice tone="error">{state.error}</Notice>
        </div>
      )}

      <TextField
        name="factoryName"
        label="Factory name"
        autoComplete="off"
        maxLength={FACTORY_NAME_MAX + 50}
        defaultValue={v?.factoryName}
        hint="How you refer to this site, for example the plant or unit name."
        error={e.factoryName}
        required
      />
      <TextField
        name="addressLine1"
        label="Address line 1"
        autoComplete="off"
        maxLength={ADDRESS_MAX + 50}
        defaultValue={v?.addressLine1}
        error={e.addressLine1}
        required
      />
      <TextField
        name="addressLine2"
        label="Address line 2 (optional)"
        autoComplete="off"
        maxLength={ADDRESS_MAX + 50}
        defaultValue={v?.addressLine2}
        error={e.addressLine2}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="city"
          label="City"
          autoComplete="off"
          maxLength={CITY_MAX + 50}
          defaultValue={v?.city}
          error={e.city}
          required
        />
        <SelectField
          name="state"
          label="State or union territory"
          options={INDIAN_STATES}
          placeholder="Choose…"
          defaultValue={v?.state ?? ""}
          error={e.state}
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="postalCode"
          label="PIN code"
          inputMode="numeric"
          autoComplete="off"
          maxLength={12}
          defaultValue={v?.postalCode}
          hint="6 digits."
          error={e.postalCode}
          required
        />
        <div className="grid gap-1.5">
          <span className="text-sm font-medium leading-none">Country</span>
          <div className="flex h-10 items-center rounded-md border border-border bg-muted px-3 text-base text-muted-foreground md:h-9 md:text-sm">
            India
          </div>
          <p className="text-xs text-muted-foreground">Fixed for now: the platform supports Indian factories only.</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 pt-1 sm:flex-row-reverse sm:justify-start">
        <Button type="submit" size="lg" className="h-11 sm:h-9" disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
        <Button asChild variant="outline" size="lg" className="h-11 sm:h-9">
          <Link href={cancelHref}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
