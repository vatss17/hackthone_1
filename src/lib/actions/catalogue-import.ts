"use server";

import { createClient } from "@/lib/supabase/server";
import { requireOrganization } from "@/lib/organization";
import { isUuid } from "@/lib/factory-validation";
import { specValue, text, positiveNumber, errorCodeFor } from "@/lib/capability-validation";
import { LIMITS } from "@/lib/catalogue/parse";

/**
 * Saves the products a person accepted in the import review. The browser sends only the reviewed
 * fields (never the uploaded file). Everything is validated again here, the company comes from the
 * session, the owner role is required, and every write goes through the user's own session, so the
 * database's permissions, constraints and audit apply. Nothing about the file or its text is kept
 * or logged.
 */

export type ImportItem = {
  name: string;
  description: string | null;
  category: string | null;
  intendedUse: string | null;
  internalCode: string | null;
  hsCode: string | null;
  unitWeightG: number | null;
  materials: { code: string | null; label: string }[];
  specs: { name: string; value: string; unit: string | null }[];
};

export type ImportResult =
  | { ok: false; error: string }
  | {
      ok: true;
      created: { id: string; name: string }[];
      skipped: { name: string; reason: string }[];
      failed: { name: string; reason: string }[];
    };

const MAX_ITEMS = 50;
const HS = /^[0-9]{4}([.]?[0-9]{2}){0,3}$/;
const REASONS = {
  duplicate: "A product with this name is already in your catalogue.",
  invalid: "Some values were not accepted. Check the name and the other fields.",
  failed: "It could not be saved right now.",
};

export async function importProducts(payload: string): Promise<ImportResult> {
  const { organization } = await requireOrganization();
  if (organization.role !== "owner") return { ok: false, error: "Only company owners can add products." };
  if (typeof payload !== "string" || payload.length > 600_000) return { ok: false, error: "That import is too large." };

  let parsed: { items?: unknown; factoryIds?: unknown };
  try {
    parsed = JSON.parse(payload);
  } catch {
    return { ok: false, error: "The import could not be read." };
  }
  if (!Array.isArray(parsed.items) || parsed.items.length === 0 || parsed.items.length > MAX_ITEMS) return { ok: false, error: `Choose between 1 and ${MAX_ITEMS} products.` };
  const factoryIds = Array.isArray(parsed.factoryIds) ? parsed.factoryIds.filter(isUuid).slice(0, 20) : [];

  const supabase = await createClient();
  const [existing, refMaterials] = await Promise.all([
    supabase.from("products").select("name").eq("organization_id", organization.id).is("archived_at", null),
    supabase.from("ref_materials").select("id, code").eq("is_active", true),
  ]);
  if (existing.error || refMaterials.error) return { ok: false, error: "We could not check your catalogue right now. Nothing was saved." };
  const taken = new Set((existing.data as { name: string }[]).map((p) => p.name.toLowerCase()));
  const materialId = new Map((refMaterials.data as { id: string; code: string }[]).map((m) => [m.code, m.id]));

  const created: { id: string; name: string }[] = [];
  const skipped: { name: string; reason: string }[] = [];
  const failed: { name: string; reason: string }[] = [];

  for (const raw of parsed.items as Record<string, unknown>[]) {
    const label = typeof raw?.name === "string" ? raw.name.slice(0, 80) : "Product";
    const name = text(raw.name, { min: 2, max: LIMITS.name, required: true });
    const description = text(raw.description, { max: LIMITS.description, long: true });
    const category = text(raw.category, { max: LIMITS.category });
    const use = text(raw.intendedUse, { max: LIMITS.use });
    const code = text(raw.internalCode, { max: LIMITS.code });
    const weight = raw.unitWeightG == null ? ({ ok: true, value: null } as const) : positiveNumber(String(raw.unitWeightG), { max: 999999999 });
    const hs = typeof raw.hsCode === "string" && raw.hsCode ? raw.hsCode.replace(/\s/g, "") : null;
    if (!weight.ok) {
      failed.push({ name: label, reason: "The unit weight must be a positive number of grams." });
      continue;
    }
    if (!name.ok || !description.ok || !category.ok || !use.ok || !code.ok || (hs !== null && !HS.test(hs))) {
      failed.push({ name: label, reason: REASONS.invalid });
      continue;
    }
    if (taken.has((name.value as string).toLowerCase())) {
      skipped.push({ name: name.value as string, reason: REASONS.duplicate });
      continue;
    }
    taken.add((name.value as string).toLowerCase());

    const { data, error } = await supabase
      .from("products")
      .insert({
        organization_id: organization.id,
        name: name.value,
        description: description.value,
        category: category.value,
        intended_use: use.value,
        internal_code: code.value,
        hs_code_claimed: hs,
        unit_weight_g: weight.value,
      })
      .select("id")
      .single();
    if (error || !data) {
      const c = error ? errorCodeFor(error) : "failed";
      (c === "duplicate" ? skipped : failed).push({ name: name.value as string, reason: c === "duplicate" ? REASONS.duplicate : c === "invalid" ? REASONS.invalid : REASONS.failed });
      continue;
    }
    const id = data.id as string;

    // Specifications, materials and factory links. A failure here leaves the product in place, and
    // the person can finish it on the product page.
    const specs = Array.isArray(raw.specs) ? (raw.specs as Record<string, unknown>[]).slice(0, LIMITS.specs) : [];
    const seenSpec = new Set<string>();
    for (const s of specs) {
      const n = text(s.name, { max: LIMITS.specName, required: true });
      const v = specValue(s.value, s.unit);
      if (!n.ok || !v.ok || seenSpec.has((n.value as string).toLowerCase())) continue;
      seenSpec.add((n.value as string).toLowerCase());
      await supabase.from("product_specifications").insert({ organization_id: organization.id, product_id: id, name: n.value, value_text: v.value.text, value_number: v.value.number, unit: v.value.unit });
    }
    const mats = Array.isArray(raw.materials) ? (raw.materials as Record<string, unknown>[]).slice(0, 8) : [];
    const seenMat = new Set<string>();
    for (const m of mats) {
      const code = typeof m.code === "string" ? m.code : null;
      const ref = code ? materialId.get(code) : undefined;
      const custom = ref ? null : text(m.label, { min: 2, max: 100, required: true });
      const customName = custom && custom.ok ? custom.value : null;
      if (!ref && !customName) continue;
      const key = (ref ?? customName ?? "").toLowerCase();
      if (seenMat.has(key)) continue;
      seenMat.add(key);
      await supabase.from("product_materials").insert({ organization_id: organization.id, product_id: id, material_id: ref ?? null, custom_name: ref ? null : customName, role: "primary" });
    }
    for (const factoryId of factoryIds) {
      await supabase.from("factory_products").insert({ organization_id: organization.id, factory_id: factoryId, product_id: id });
    }
    created.push({ id, name: name.value as string });
  }
  return { ok: true, created, skipped, failed };
}
