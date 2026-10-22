import "server-only";
import { getProductDetail } from "@/lib/capabilities";
import { CATALOGUE_BY_ID } from "@/lib/opportunities/catalogue";
import { recognise } from "@/lib/opportunities/engine";
import { isUuid } from "@/lib/factory-validation";
import type { CatalogueEntry } from "@/lib/opportunities/types";

export type Subject = { ref: string; name: string; entry: CatalogueEntry | null; own: boolean };

/**
 * Resolves the optional ?product= query on the preview pages to a product the user may look at:
 * one of the catalogue products, or one of THEIR OWN products (looked up inside their company).
 * Anything else resolves to null and the page simply shows its general form.
 */
export async function resolveSubject(organizationId: string, raw: string | string[] | undefined): Promise<Subject | null> {
  const ref = typeof raw === "string" ? raw : undefined;
  if (!ref) return null;
  const entry = CATALOGUE_BY_ID[ref];
  if (entry) return { ref, name: entry.name, entry, own: false };
  if (!isUuid(ref)) return null;
  const p = await getProductDetail(organizationId, ref);
  if (!p) return null;
  return { ref, name: p.name, entry: recognise({ name: p.name, category: p.category, description: p.description }), own: true };
}
