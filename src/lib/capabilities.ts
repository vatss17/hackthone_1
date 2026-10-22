import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { listFactories } from "@/lib/factories";
import { MATERIAL_NAMES, PROCESS_NAMES } from "@/lib/opportunities/engine";
import type { FactoryInput, MaterialCode, ProcessCode } from "@/lib/opportunities/types";

/**
 * Reads of the manufacturing profile. All run as the signed-in user, so Row Level Security
 * limits every row to their own company; the explicit organization filters are defence in depth.
 * A database failure throws (error page) rather than looking like "nothing declared".
 */

export type RefItem = { id: string; code: string; name: string };

export const getReferenceData = cache(async (): Promise<{ processes: RefItem[]; materials: RefItem[] }> => {
  const supabase = await createClient();
  const [p, m] = await Promise.all([
    supabase.from("ref_processes").select("id, code, name").eq("is_active", true).order("sort_order"),
    supabase.from("ref_materials").select("id, code, name").eq("is_active", true).order("sort_order"),
  ]);
  if (p.error || m.error) throw new Error("Could not load reference lists.");
  return { processes: p.data as RefItem[], materials: m.data as RefItem[] };
});

export type ProcessRow = {
  id: string;
  scope: "process" | "factory_wide";
  processId: string | null;
  processCode: ProcessCode | null;
  label: string;
  custom: boolean;
  capacityQuantity: number | null;
  capacityUnit: string | null;
  capacityPeriod: string | null;
  notes: string | null;
};

export type MachineRow = {
  id: string;
  name: string;
  make: string | null;
  model: string | null;
  quantity: number;
  processId: string | null;
  processCode: ProcessCode | null;
  processName: string | null;
  ratingValue: number | null;
  ratingUnit: string | null;
  yearInstalled: number | null;
  notes: string | null;
};

export type MaterialRow = { id: string; materialId: string | null; code: MaterialCode | null; label: string; custom: boolean };

export type LinkedProduct = { linkId: string; productId: string; name: string; category: string | null };

export type FactoryProfile = {
  processes: ProcessRow[];
  factoryWide: ProcessRow | null;
  machines: MachineRow[];
  materials: MaterialRow[];
  products: LinkedProduct[];
};

type Embedded<T> = T | T[] | null;
const one = <T,>(v: Embedded<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export async function getFactoryProfile(organizationId: string, factoryId: string): Promise<FactoryProfile> {
  const supabase = await createClient();
  const q = (table: string, select: string) =>
    supabase.from(table).select(select).eq("organization_id", organizationId).eq("factory_id", factoryId);
  const [proc, mach, mat, links] = await Promise.all([
    q("factory_processes", "id, scope, process_id, custom_name, capacity_quantity, capacity_unit, capacity_period, notes, ref:ref_processes(code, name)").order("created_at"),
    q("machines", "id, name, make, model, quantity, process_id, rating_value, rating_unit, year_installed, notes, ref:ref_processes(code, name)").is("archived_at", null).order("created_at"),
    q("factory_materials", "id, material_id, custom_name, ref:ref_materials(code, name)").order("created_at"),
    q("factory_products", "id, product_id, product:products(name, category, archived_at)").order("created_at"),
  ]);
  if (proc.error || mach.error || mat.error || links.error) throw new Error("Could not load the factory profile.");

  const processes: ProcessRow[] = (proc.data as unknown as Record<string, unknown>[]).map((r) => {
    const ref = one(r.ref as Embedded<{ code: string; name: string }>);
    return {
      id: r.id as string,
      scope: r.scope as "process" | "factory_wide",
      processId: r.process_id as string | null,
      processCode: (ref?.code as ProcessCode | undefined) ?? null,
      label: ref?.name ?? (r.custom_name as string | null) ?? "Factory-wide",
      custom: !ref && r.scope === "process",
      capacityQuantity: r.capacity_quantity === null ? null : Number(r.capacity_quantity),
      capacityUnit: r.capacity_unit as string | null,
      capacityPeriod: r.capacity_period as string | null,
      notes: r.notes as string | null,
    };
  });
  const machines: MachineRow[] = (mach.data as unknown as Record<string, unknown>[]).map((r) => {
    const ref = one(r.ref as Embedded<{ code: string; name: string }>);
    return {
      id: r.id as string,
      name: r.name as string,
      make: r.make as string | null,
      model: r.model as string | null,
      quantity: r.quantity as number,
      processId: r.process_id as string | null,
      processCode: (ref?.code as ProcessCode | undefined) ?? null,
      processName: ref?.name ?? null,
      ratingValue: r.rating_value === null ? null : Number(r.rating_value),
      ratingUnit: r.rating_unit as string | null,
      yearInstalled: r.year_installed as number | null,
      notes: r.notes as string | null,
    };
  });
  const materials: MaterialRow[] = (mat.data as unknown as Record<string, unknown>[]).map((r) => {
    const ref = one(r.ref as Embedded<{ code: string; name: string }>);
    return {
      id: r.id as string,
      materialId: r.material_id as string | null,
      code: (ref?.code as MaterialCode | undefined) ?? null,
      label: ref?.name ?? (r.custom_name as string),
      custom: !ref,
    };
  });
  const products: LinkedProduct[] = (links.data as unknown as Record<string, unknown>[])
    .map((r) => ({ r, p: one(r.product as Embedded<{ name: string; category: string | null; archived_at: string | null }>) }))
    .filter((x) => x.p && !x.p.archived_at)
    .map((x) => ({ linkId: x.r.id as string, productId: x.r.product_id as string, name: x.p!.name, category: x.p!.category }));

  return {
    processes: processes.filter((p) => p.scope === "process"),
    factoryWide: processes.find((p) => p.scope === "factory_wide") ?? null,
    machines,
    materials,
    products,
  };
}

export type ProductSummary = {
  id: string;
  name: string;
  category: string | null;
  intendedUse: string | null;
  description: string | null;
  factories: { linkId: string; factoryId: string; name: string }[];
  specCount: number;
};

export async function listProducts(organizationId: string): Promise<ProductSummary[]> {
  const supabase = await createClient();
  const [prod, links, specs] = await Promise.all([
    supabase.from("products").select("id, name, category, intended_use, description").eq("organization_id", organizationId).is("archived_at", null).order("created_at"),
    supabase.from("factory_products").select("id, product_id, factory_id, factory:factories(name, archived_at)").eq("organization_id", organizationId),
    supabase.from("product_specifications").select("product_id").eq("organization_id", organizationId),
  ]);
  if (prod.error || links.error || specs.error) throw new Error("Could not load products.");
  const linkRows = links.data as unknown as { id: string; product_id: string; factory_id: string; factory: Embedded<{ name: string; archived_at: string | null }> }[];
  return (prod.data as unknown as Record<string, string | null>[]).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    category: p.category,
    intendedUse: p.intended_use,
    description: p.description,
    factories: linkRows
      .filter((l) => l.product_id === p.id && !one(l.factory)?.archived_at)
      .map((l) => ({ linkId: l.id, factoryId: l.factory_id, name: one(l.factory)?.name ?? "Factory" })),
    specCount: (specs.data as { product_id: string }[]).filter((s) => s.product_id === p.id).length,
  }));
}

export type ProductDetail = {
  id: string;
  name: string;
  internalCode: string | null;
  description: string | null;
  category: string | null;
  intendedUse: string | null;
  hsCodeClaimed: string | null;
  unitWeightG: number | null;
  specs: { id: string; name: string; value: string; unit: string | null }[];
  factories: { linkId: string; factoryId: string; name: string }[];
};

export async function getProductDetail(organizationId: string, id: string): Promise<ProductDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, internal_code, description, category, intended_use, hs_code_claimed, unit_weight_g")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw new Error("Could not load the product.");
  if (!data) return null;
  const [specs, links] = await Promise.all([
    supabase.from("product_specifications").select("id, name, value_text, value_number, unit").eq("organization_id", organizationId).eq("product_id", id).order("created_at"),
    supabase.from("factory_products").select("id, factory_id, factory:factories(name, archived_at)").eq("organization_id", organizationId).eq("product_id", id),
  ]);
  if (specs.error || links.error) throw new Error("Could not load the product.");
  const d = data as Record<string, string | number | null>;
  return {
    id: d.id as string,
    name: d.name as string,
    internalCode: d.internal_code as string | null,
    description: d.description as string | null,
    category: d.category as string | null,
    intendedUse: d.intended_use as string | null,
    hsCodeClaimed: d.hs_code_claimed as string | null,
    unitWeightG: d.unit_weight_g === null ? null : Number(d.unit_weight_g),
    specs: (specs.data as unknown as { id: string; name: string; value_text: string | null; value_number: string | number | null; unit: string | null }[]).map((s) => ({
      id: s.id,
      name: s.name,
      value: s.value_text ?? String(Number(s.value_number)),
      unit: s.unit,
    })),
    factories: (links.data as unknown as { id: string; factory_id: string; factory: Embedded<{ name: string; archived_at: string | null }> }[])
      .filter((l) => !one(l.factory)?.archived_at)
      .map((l) => ({ linkId: l.id, factoryId: l.factory_id, name: one(l.factory)?.name ?? "Factory" })),
  };
}

const PERIOD_LABEL: Record<string, string> = { day: "per day", month: "per month", year: "per year" };
const UNIT_LABEL: Record<string, string> = { kg: "kg", tonnes: "tonnes", pieces: "pieces", metres: "metres", m2: "m²" };

export function capacityText(p: { capacityQuantity: number | null; capacityUnit: string | null; capacityPeriod: string | null }): string | null {
  if (p.capacityQuantity === null || !p.capacityUnit || !p.capacityPeriod) return null;
  return `${new Intl.NumberFormat("en-IN").format(p.capacityQuantity)} ${UNIT_LABEL[p.capacityUnit] ?? p.capacityUnit} ${PERIOD_LABEL[p.capacityPeriod] ?? p.capacityPeriod}`;
}

/**
 * Everything the opportunity engine needs, built from the company's REAL saved records across its
 * active factories. Nothing here is invented: if a field is empty the engine sees it as empty.
 */
export async function loadEngineInput(organizationId: string): Promise<{
  input: FactoryInput;
  factories: { id: string; name: string }[];
  counts: { processes: number; machines: number; materials: number; products: number };
}> {
  const { active } = await listFactories(organizationId);
  const [profiles, products] = await Promise.all([
    Promise.all(active.map((f) => getFactoryProfile(organizationId, f.id))),
    listProducts(organizationId),
  ]);

  const processes = new Map<string, FactoryInput["processes"][number]>();
  const materials = new Map<string, FactoryInput["materials"][number]>();
  const machines: FactoryInput["machines"] = [];
  let factoryWide: string | null = null;
  for (const p of profiles) {
    for (const r of p.processes) {
      const key = r.processCode ?? `custom:${r.label.toLowerCase()}`;
      const text = capacityText(r);
      const prior = processes.get(key);
      if (!prior || (!prior.capacityText && text)) processes.set(key, { code: r.processCode, label: r.processCode ? PROCESS_NAMES[r.processCode] : r.label, capacityText: text });
    }
    for (const m of p.materials) {
      const key = m.code ?? `custom:${m.label.toLowerCase()}`;
      if (!materials.has(key)) materials.set(key, { code: m.code, label: m.code ? MATERIAL_NAMES[m.code] : m.label });
    }
    for (const m of p.machines) {
      machines.push({ processCode: m.processCode, name: m.name, quantity: m.quantity, ratingValue: m.ratingValue, ratingUnit: m.ratingUnit });
    }
    if (!factoryWide && p.factoryWide) factoryWide = capacityText(p.factoryWide);
  }
  return {
    input: {
      processes: [...processes.values()],
      materials: [...materials.values()],
      machines,
      factoryWideCapacity: factoryWide,
      products: products.map((p) => ({ id: p.id, name: p.name, category: p.category, description: p.description })),
    },
    factories: active.map((f) => ({ id: f.id, name: f.name })),
    counts: { processes: processes.size, machines: machines.reduce((n, m) => n + m.quantity, 0), materials: materials.size, products: products.length },
  };
}
