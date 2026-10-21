import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser, type CurrentUser } from "@/lib/auth";

export type CurrentOrganization = {
  id: string;
  name: string;
  legalName: string | null;
  role: "owner" | "member";
  createdAt: string;
};

/**
 * The signed-in user's company, or null if they have not registered one.
 *
 * Runs as the user (publishable key + session), so Row Level Security decides what is
 * visible: a user can only ever see their own membership and the organization it
 * points to. One organization per user is enforced by the database.
 *
 * A database failure throws (shown by the error boundary) instead of returning null:
 * "could not check" must never be mistaken for "has no company" and send an existing
 * owner back to registration.
 */
export const getCurrentOrganization = cache(async (): Promise<CurrentOrganization | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("role, organization:organizations(id, name, legal_name, created_at)")
    .limit(1)
    .maybeSingle();

  if (error) throw new Error("Could not load your company.");
  if (!data) return null;

  const org = Array.isArray(data.organization) ? data.organization[0] : data.organization;
  if (!org) return null;
  return {
    id: org.id,
    name: org.name,
    legalName: org.legal_name,
    role: data.role,
    createdAt: org.created_at,
  };
});

/**
 * Guard for pages that need a company. Validates the user on the server first, then
 * sends users without a company to registration.
 */
export async function requireOrganization(): Promise<{ user: CurrentUser; organization: CurrentOrganization }> {
  const user = await requireUser();
  const organization = await getCurrentOrganization();
  if (!organization) redirect("/onboarding");
  return { user, organization };
}
