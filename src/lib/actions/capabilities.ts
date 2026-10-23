"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOrganization } from "@/lib/organization";
import { isUuid } from "@/lib/factory-validation";
import {
  CAPACITY_PERIODS,
  CAPACITY_UNITS,
  RATING_UNITS,
  clean,
  errorCodeFor,
  oneOf,
  positiveNumber,
  specValue,
  text,
  yearOrNull,
  type ErrorCode,
} from "@/lib/capability-validation";

/**
 * Server Actions for the manufacturing profile (processes, capacity, machinery, materials,
 * products, specifications, factory association).
 *
 * Every action: validates the signed-in user and company on the server, requires the company
 * owner role, takes the company from the session (never the request), validates input, and writes
 * through the user's own session so the database's permissions, constraints and audit apply.
 * Nothing here uses the service role. On success or failure the action redirects back with a fixed
 * notice or error code; no database text ever reaches the page.
 */

const rowId = (fd: FormData, key = "id") => {
  const v = fd.get(key);
  return isUuid(v) ? v : null;
};

function go(back: string, anchor: string, kind: "notice" | "error", code: string): never {
  redirect(`${back}${back.includes("?") ? "&" : "?"}${kind}=${code}#${anchor}`);
}

async function owner(back: string, anchor: string) {
  const { organization } = await requireOrganization();
  if (organization.role !== "owner") go(back, anchor, "error", "not_owner");
  return organization;
}

const bad = (back: string, anchor: string): never => go(back, anchor, "error", "invalid" satisfies ErrorCode);

function factoryBack(fd: FormData): string {
  const id = rowId(fd, "factoryId");
  if (!id) redirect("/factories");
  // The guided setup sends the step it came from, so the person stays in the flow. Only 1 to 5 is accepted.
  const step = clean(fd.get("returnStep"));
  if (/^[1-5]$/.test(step)) return `/factories/${id}/setup?step=${step}`;
  return `/factories/${id}`;
}

function productBack(fd: FormData): string {
  const id = rowId(fd, "productId");
  if (!id) redirect("/products");
  return `/products/${id}`;
}

function finish(error: { code?: string | null; message?: string | null } | null, back: string, anchor: string, notice: string): never {
  if (error) go(back, anchor, "error", errorCodeFor(error));
  go(back, anchor, "notice", notice);
}

// ---- processes and capacity ------------------------------------------------------------------

function capacityFields(fd: FormData): { quantity: number | null; unit: string | null; period: string | null } | null {
  const q = positiveNumber(fd.get("capacityQuantity"), { max: 99999999999 });
  if (!q.ok) return null;
  const unit = oneOf(fd.get("capacityUnit"), CAPACITY_UNITS);
  const period = oneOf(fd.get("capacityPeriod"), CAPACITY_PERIODS);
  if (q.value === null) return { quantity: null, unit: null, period: null };
  if (!unit || !period) return null;
  return { quantity: q.value, unit, period };
}

export async function addProcess(fd: FormData): Promise<void> {
  const back = factoryBack(fd);
  const anchor = "processes";
  const org = await owner(back, anchor);
  const factoryId = rowId(fd, "factoryId")!;
  const choice = clean(fd.get("process"));
  const custom = text(fd.get("customName"), { min: 2, max: 100 });
  const cap = capacityFields(fd);
  if (!custom.ok || !cap) return bad(back, anchor);
  const useRef = isUuid(choice);
  if (useRef === (custom.value !== null)) return bad(back, anchor); // exactly one of the two
  const supabase = await createClient();
  const { error } = await supabase.from("factory_processes").insert({
    organization_id: org.id,
    factory_id: factoryId,
    scope: "process",
    process_id: useRef ? choice : null,
    custom_name: useRef ? null : custom.value,
    capacity_quantity: cap.quantity,
    capacity_unit: cap.unit,
    capacity_period: cap.period,
  });
  finish(error, back, anchor, "process_added");
}

export async function updateProcess(fd: FormData): Promise<void> {
  const back = factoryBack(fd);
  const anchor = "processes";
  const org = await owner(back, anchor);
  const id = rowId(fd);
  const cap = capacityFields(fd);
  if (!id || !cap) return bad(back, anchor);
  const supabase = await createClient();
  const { error } = await supabase
    .from("factory_processes")
    .update({ capacity_quantity: cap.quantity, capacity_unit: cap.unit, capacity_period: cap.period })
    .eq("id", id)
    .eq("organization_id", org.id);
  finish(error, back, anchor, "process_updated");
}

export async function removeProcess(fd: FormData): Promise<void> {
  const back = factoryBack(fd);
  const anchor = "processes";
  const org = await owner(back, anchor);
  const id = rowId(fd);
  if (!id) return bad(back, anchor);
  const supabase = await createClient();
  const { error } = await supabase.from("factory_processes").delete().eq("id", id).eq("organization_id", org.id);
  finish(error, back, anchor, "process_removed");
}

/** Sets (creates or replaces) the single factory-wide capacity row of a factory. */
export async function saveFactoryWideCapacity(fd: FormData): Promise<void> {
  const back = factoryBack(fd);
  const anchor = "processes";
  const org = await owner(back, anchor);
  const factoryId = rowId(fd, "factoryId")!;
  const cap = capacityFields(fd);
  if (!cap || cap.quantity === null) return bad(back, anchor);
  const supabase = await createClient();
  const existing = await supabase
    .from("factory_processes")
    .select("id")
    .eq("organization_id", org.id)
    .eq("factory_id", factoryId)
    .eq("scope", "factory_wide")
    .maybeSingle();
  if (existing.error) go(back, anchor, "error", "failed");
  const { error } = existing.data
    ? await supabase
        .from("factory_processes")
        .update({ capacity_quantity: cap.quantity, capacity_unit: cap.unit, capacity_period: cap.period })
        .eq("id", existing.data.id)
        .eq("organization_id", org.id)
    : await supabase.from("factory_processes").insert({
        organization_id: org.id,
        factory_id: factoryId,
        scope: "factory_wide",
        capacity_quantity: cap.quantity,
        capacity_unit: cap.unit,
        capacity_period: cap.period,
      });
  finish(error, back, anchor, "capacity_saved");
}

// ---- machinery -------------------------------------------------------------------------------

function machineFields(fd: FormData) {
  const name = text(fd.get("name"), { min: 2, max: 200, required: true });
  const make = text(fd.get("make"), { max: 100 });
  const model = text(fd.get("model"), { max: 100 });
  const qty = positiveNumber(fd.get("quantity"), { max: 10000, integer: true, required: true });
  const rating = positiveNumber(fd.get("ratingValue"), { max: 999999999 });
  const unit = oneOf(fd.get("ratingUnit"), RATING_UNITS);
  const year = yearOrNull(fd.get("yearInstalled"));
  const processRaw = clean(fd.get("process"));
  if (!name.ok || !make.ok || !model.ok || !qty.ok || !rating.ok || !year.ok) return null;
  if ((rating.value === null) !== (unit === null)) return null;
  if (processRaw !== "" && !isUuid(processRaw)) return null;
  return {
    name: name.value,
    make: make.value,
    model: model.value,
    quantity: qty.value,
    rating_value: rating.value,
    rating_unit: rating.value === null ? null : unit,
    year_installed: year.value,
    process_id: processRaw === "" ? null : processRaw,
  };
}

export async function addMachine(fd: FormData): Promise<void> {
  const back = factoryBack(fd);
  const anchor = "machinery";
  const org = await owner(back, anchor);
  const f = machineFields(fd);
  if (!f) return bad(back, anchor);
  const supabase = await createClient();
  const { error } = await supabase.from("machines").insert({ organization_id: org.id, factory_id: rowId(fd, "factoryId")!, ...f });
  finish(error, back, anchor, "machine_added");
}

export async function updateMachine(fd: FormData): Promise<void> {
  const back = factoryBack(fd);
  const anchor = "machinery";
  const org = await owner(back, anchor);
  const id = rowId(fd);
  const f = machineFields(fd);
  if (!id || !f) return bad(back, anchor);
  const supabase = await createClient();
  const { error } = await supabase.from("machines").update(f).eq("id", id).eq("organization_id", org.id).is("archived_at", null);
  finish(error, back, anchor, "machine_updated");
}

/** Machines are independent records: they are archived, never deleted. */
export async function archiveMachine(fd: FormData): Promise<void> {
  const back = factoryBack(fd);
  const anchor = "machinery";
  const org = await owner(back, anchor);
  const id = rowId(fd);
  if (!id) return bad(back, anchor);
  const supabase = await createClient();
  const { error } = await supabase
    .from("machines")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", org.id)
    .is("archived_at", null);
  finish(error, back, anchor, "machine_removed");
}

// ---- materials -------------------------------------------------------------------------------

export async function addMaterial(fd: FormData): Promise<void> {
  const back = factoryBack(fd);
  const anchor = "materials";
  const org = await owner(back, anchor);
  const choice = clean(fd.get("material"));
  const custom = text(fd.get("customName"), { min: 2, max: 100 });
  if (!custom.ok) return bad(back, anchor);
  const useRef = isUuid(choice);
  if (useRef === (custom.value !== null)) return bad(back, anchor);
  const supabase = await createClient();
  const { error } = await supabase.from("factory_materials").insert({
    organization_id: org.id,
    factory_id: rowId(fd, "factoryId")!,
    material_id: useRef ? choice : null,
    custom_name: useRef ? null : custom.value,
  });
  finish(error, back, anchor, "material_added");
}

export async function removeMaterial(fd: FormData): Promise<void> {
  const back = factoryBack(fd);
  const anchor = "materials";
  const org = await owner(back, anchor);
  const id = rowId(fd);
  if (!id) return bad(back, anchor);
  const supabase = await createClient();
  const { error } = await supabase.from("factory_materials").delete().eq("id", id).eq("organization_id", org.id);
  finish(error, back, anchor, "material_removed");
}

// ---- products --------------------------------------------------------------------------------

function productFields(fd: FormData) {
  const name = text(fd.get("name"), { min: 2, max: 200, required: true });
  const category = text(fd.get("category"), { max: 100 });
  const intendedUse = text(fd.get("intendedUse"), { max: 500 });
  const description = text(fd.get("description"), { max: 2000, long: true });
  const code = text(fd.get("internalCode"), { max: 60 });
  const weight = positiveNumber(fd.get("unitWeightG"), { max: 999999999 });
  if (!name.ok || !category.ok || !intendedUse.ok || !description.ok || !code.ok || !weight.ok) return null;
  return {
    name: name.value,
    category: category.value,
    intended_use: intendedUse.value,
    description: description.value,
    internal_code: code.value,
    unit_weight_g: weight.value,
  };
}

export async function createProduct(fd: FormData): Promise<void> {
  const org = await owner("/products/new", "form");
  const f = productFields(fd);
  if (!f) return bad("/products/new", "form");

  const factoryIds = fd.getAll("factoryIds").filter(isUuid);
  const specs: { name: string; v: { text: string | null; number: number | null; unit: string | null } }[] = [];
  for (let i = 1; i <= 3; i++) {
    const n = clean(fd.get(`specName${i}`));
    const val = clean(fd.get(`specValue${i}`));
    if (n === "" && val === "") continue;
    const parsed = specValue(val, fd.get(`specUnit${i}`));
    const nameOk = text(n, { max: 100, required: true });
    if (!parsed.ok || !nameOk.ok) return bad("/products/new", "form");
    specs.push({ name: nameOk.value as string, v: parsed.value });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("products").insert({ organization_id: org.id, ...f }).select("id").single();
  if (error || !data) go("/products/new", "form", "error", error ? errorCodeFor(error) : "failed");
  const id = data!.id as string;

  // Specifications and factory links go in after the product. If one fails, the product still
  // exists; the owner lands on its page with the error and can finish there.
  let failure: ErrorCode | null = null;
  for (const s of specs) {
    const r = await supabase.from("product_specifications").insert({
      organization_id: org.id,
      product_id: id,
      name: s.name,
      value_text: s.v.text,
      value_number: s.v.number,
      unit: s.v.unit,
    });
    if (r.error && !failure) failure = errorCodeFor(r.error);
  }
  for (const factoryId of factoryIds) {
    const r = await supabase.from("factory_products").insert({ organization_id: org.id, factory_id: factoryId, product_id: id });
    if (r.error && !failure) failure = errorCodeFor(r.error);
  }
  if (failure) go(`/products/${id}`, "details", "error", failure);
  go(`/products/${id}`, "details", "notice", "product_added");
}

/**
 * Saves only the manufacturer's own claimed HS/HSN code, from the classification step of Explore. Same owner check and
 * company scope as every product edit. The code is stored exactly as claimed (4 to 10 digits) and is never verified here.
 */
async function saveHsClaim(fd: FormData): Promise<void> {
  const id = rowId(fd, "productId");
  if (!id) redirect("/products");
  const back = `/opportunities/${id}?stage=3`;
  const anchor = "hs";
  const org = await owner(back, anchor);
  const raw = clean(fd.get("hsCode")).replace(/\s+/g, "");
  if (raw !== "" && !/^\d{4}([.]?\d{2}){0,3}$/.test(raw)) return bad(back, anchor);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .update({ hs_code_claimed: raw === "" ? null : raw })
    .eq("id", id)
    .eq("organization_id", org.id)
    .is("archived_at", null)
    .select("id");
  if (!error && (!data || data.length === 0)) redirect("/products");
  finish(error, back, anchor, raw === "" ? "hs_cleared" : "hs_saved");
}

export async function updateProduct(fd: FormData): Promise<void> {
  if (clean(fd.get("only")) === "hs") return saveHsClaim(fd);
  const back = productBack(fd);
  const anchor = "details";
  const org = await owner(back, anchor);
  const f = productFields(fd);
  if (!f) return bad(back, anchor);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .update(f)
    .eq("id", rowId(fd, "productId")!)
    .eq("organization_id", org.id)
    .is("archived_at", null)
    .select("id");
  if (!error && (!data || data.length === 0)) redirect("/products");
  finish(error, back, anchor, "product_updated");
}

/**
 * Brings an archived product back. It calls the owner-only restore_product database function (see the proposed migration), because archived
 * rows are frozen against ordinary updates. Until that function exists on the database, this says so plainly and changes nothing.
 */
export async function restoreProduct(fd: FormData): Promise<void> {
  const id = rowId(fd, "productId");
  if (!id) redirect("/products");
  await owner("/products", "archived");
  const supabase = await createClient();
  const { error } = await supabase.rpc("restore_product", { p_product_id: id });
  if (!error) redirect(`/products?notice=product_restored#archived`);
  // PGRST202 / 42883: the function is not on this database yet. P0002: not found or not yours. 23505: an active product has the same name.
  const code = (error as { code?: string }).code;
  if (code === "PGRST202" || code === "42883") redirect("/products?error=restore_unavailable#archived");
  if (code === "23505") redirect("/products?error=restore_duplicate#archived");
  if (code === "P0002") redirect("/products?error=restore_missing#archived");
  redirect("/products?error=failed#archived");
}

export async function archiveProduct(fd: FormData): Promise<void> {
  const back = productBack(fd);
  const org = await owner(back, "details");
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", rowId(fd, "productId")!)
    .eq("organization_id", org.id)
    .is("archived_at", null);
  if (error) go(back, "details", "error", errorCodeFor(error));
  redirect(`/products?notice=product_archived&archived=${rowId(fd, "productId")}`);
}

export async function addSpecification(fd: FormData): Promise<void> {
  const back = productBack(fd);
  const anchor = "specifications";
  const org = await owner(back, anchor);
  const name = text(fd.get("name"), { max: 100, required: true });
  const v = specValue(fd.get("value"), fd.get("unit"));
  if (!name.ok || !v.ok) return bad(back, anchor);
  const supabase = await createClient();
  const { error } = await supabase.from("product_specifications").insert({
    organization_id: org.id,
    product_id: rowId(fd, "productId")!,
    name: name.value,
    value_text: v.value.text,
    value_number: v.value.number,
    unit: v.value.unit,
  });
  finish(error, back, anchor, "spec_added");
}

export async function removeSpecification(fd: FormData): Promise<void> {
  const back = productBack(fd);
  const anchor = "specifications";
  const org = await owner(back, anchor);
  const id = rowId(fd);
  if (!id) return bad(back, anchor);
  const supabase = await createClient();
  const { error } = await supabase.from("product_specifications").delete().eq("id", id).eq("organization_id", org.id);
  finish(error, back, anchor, "spec_removed");
}

export async function linkFactory(fd: FormData): Promise<void> {
  const back = clean(fd.get("returnStep")) ? factoryBack(fd) : productBack(fd);
  const anchor = "factories";
  const org = await owner(back, anchor);
  const factoryId = rowId(fd, "factoryId");
  if (!factoryId) return bad(back, anchor);
  const supabase = await createClient();
  const { error } = await supabase
    .from("factory_products")
    .insert({ organization_id: org.id, factory_id: factoryId, product_id: rowId(fd, "productId")! });
  finish(error, back, anchor, "link_added");
}

export async function unlinkFactory(fd: FormData): Promise<void> {
  const back = productBack(fd);
  const anchor = "factories";
  const org = await owner(back, anchor);
  const id = rowId(fd);
  if (!id) return bad(back, anchor);
  const supabase = await createClient();
  const { error } = await supabase.from("factory_products").delete().eq("id", id).eq("organization_id", org.id);
  finish(error, back, anchor, "link_removed");
}
