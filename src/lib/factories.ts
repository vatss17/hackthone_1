import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Factory } from "@/lib/factory-types";

const COLUMNS =
  "id, name, address_line1, address_line2, city, state, postal_code, country, created_at, archived_at";

type Row = {
  id: string;
  name: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  created_at: string;
  archived_at: string | null;
};

const toFactory = (r: Row): Factory => ({
  id: r.id,
  name: r.name,
  addressLine1: r.address_line1,
  addressLine2: r.address_line2,
  city: r.city,
  state: r.state,
  postalCode: r.postal_code,
  country: r.country,
  createdAt: r.created_at,
  archivedAt: r.archived_at,
});

/**
 * All factories of one company, split into active and archived. Runs as the user, so
 * Row Level Security already limits rows to their own company; the explicit
 * organization filter is defense in depth (and keeps a future staff user, who can read
 * every company, from seeing other companies' factories here).
 *
 * A database failure throws (the error page is shown): "could not load" must never look
 * like "has no factories", which would send an existing company back to registration.
 */
export async function listFactories(organizationId: string): Promise<{ active: Factory[]; archived: Factory[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("factories")
    .select(COLUMNS)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });
  if (error) throw new Error("Could not load factories.");
  const all = (data as Row[]).map(toFactory);
  return { active: all.filter((f) => !f.archivedAt), archived: all.filter((f) => f.archivedAt) };
}

/** One ACTIVE factory of this company, or null (unknown id, other company, or archived). */
export async function getActiveFactory(organizationId: string, id: string): Promise<Factory | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("factories")
    .select(COLUMNS)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw new Error("Could not load the factory.");
  return data ? toFactory(data as Row) : null;
}
