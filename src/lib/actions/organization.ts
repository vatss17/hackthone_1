"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { validateCompany } from "@/lib/organization-validation";
import { mapRegisterError } from "@/lib/organization-errors";
import type { CompanyFormState } from "@/lib/organization-types";

/**
 * Register the signed-in user's company.
 *
 * Identity comes from the validated session only. The form supplies two text
 * fields and nothing else: a user id, organization id or role in the request is
 * never read. The organization and the owner membership are created atomically by
 * the create_organization database function, which enforces one company per user
 * and serializes concurrent submissions with a per-user lock. The application never
 * inserts into organizations or memberships directly.
 */
export async function registerCompany(_prev: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  await requireUser(); // signed-out callers are redirected to /login before anything else runs

  const checked = validateCompany(formData.get("companyName"), formData.get("legalName"));
  if (!checked.ok) return { fieldErrors: checked.fieldErrors, values: checked.values };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_organization", {
    p_name: checked.name,
    p_legal_name: checked.legalName,
  });

  if (error) {
    const outcome = mapRegisterError(error, checked.values);
    if (outcome.kind === "signed-out") redirect("/login");
    if (outcome.kind === "already-registered") redirect("/");
    return outcome.state;
  }

  redirect("/"); // the dashboard now finds the company
}
