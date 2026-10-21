"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOrganization } from "@/lib/organization";
import { listFactories } from "@/lib/factories";
import { validateFactory, isUuid } from "@/lib/factory-validation";
import { mapFactoryWriteError } from "@/lib/factory-errors";
import type { FactoryFormState } from "@/lib/factory-types";

function fields(formData: FormData) {
  return validateFactory({
    factoryName: formData.get("factoryName"),
    addressLine1: formData.get("addressLine1"),
    addressLine2: formData.get("addressLine2"),
    city: formData.get("city"),
    state: formData.get("state"),
    postalCode: formData.get("postalCode"),
  });
}

const NOT_OWNER: FactoryFormState = { error: "Only company owners can add or change factories." };

/**
 * Add a factory to the signed-in user's company.
 *
 * The company comes from the server-validated session and the database membership,
 * never from the request. The form supplies six text fields; the country is fixed to
 * India by the database and created_by is set by the database. Row Level Security
 * allows the insert only for an owner of that company.
 */
export async function addFactory(_prev: FactoryFormState, formData: FormData): Promise<FactoryFormState> {
  const { organization } = await requireOrganization();
  if (organization.role !== "owner") return NOT_OWNER;

  const checked = fields(formData);
  if (!checked.ok) return { fieldErrors: checked.fieldErrors, values: checked.values };
  const v = checked.values;

  const before = await listFactories(organization.id);

  const supabase = await createClient();
  const { error } = await supabase.from("factories").insert({
    organization_id: organization.id,
    name: v.factoryName,
    address_line1: v.addressLine1,
    address_line2: v.addressLine2 || null,
    city: v.city,
    state: v.state,
    postal_code: v.postalCode,
  });
  if (error) return mapFactoryWriteError(error, v);

  // First factory completes onboarding; later ones return to the factory list.
  redirect(before.active.length === 0 ? "/" : "/factories?notice=factory_added");
}

/** Edit an active factory of this company. The id is checked against the company in the query. */
export async function updateFactory(_prev: FactoryFormState, formData: FormData): Promise<FactoryFormState> {
  const { organization } = await requireOrganization();
  const id = formData.get("id");
  if (!isUuid(id)) redirect("/factories");
  if (organization.role !== "owner") return NOT_OWNER;

  const checked = fields(formData);
  if (!checked.ok) return { fieldErrors: checked.fieldErrors, values: checked.values };
  const v = checked.values;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("factories")
    .update({
      name: v.factoryName,
      address_line1: v.addressLine1,
      address_line2: v.addressLine2 || null,
      city: v.city,
      state: v.state,
      postal_code: v.postalCode,
    })
    .eq("id", id)
    .eq("organization_id", organization.id)
    .is("archived_at", null)
    .select("id");
  if (error) return mapFactoryWriteError(error, v);
  // No row updated: the factory is not in this company, or is already archived.
  if (!data || data.length === 0) redirect("/factories?notice=factory_missing");

  redirect("/factories?notice=factory_updated");
}

/**
 * Archive (soft delete) an active factory. Factories are never deleted by the
 * application: the row stays, hidden from the active list, and its name becomes
 * reusable (the unique index only covers active factories).
 */
export async function archiveFactory(formData: FormData): Promise<void> {
  const { organization } = await requireOrganization();
  const id = formData.get("id");
  if (!isUuid(id)) redirect("/factories");
  if (organization.role !== "owner") redirect("/factories?notice=not_owner");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("factories")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", organization.id)
    .is("archived_at", null)
    .select("id");
  if (error) redirect("/factories?notice=archive_failed");
  if (!data || data.length === 0) redirect("/factories?notice=factory_missing");

  // The list page never redirects, so archiving the last active factory cannot loop:
  // it shows an empty state with a clear way to add a replacement.
  redirect("/factories?notice=factory_archived");
}
