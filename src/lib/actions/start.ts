"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOrganization } from "@/lib/organization";
import { getReferenceData } from "@/lib/capabilities";
import { validateFactory } from "@/lib/factory-validation";
import { clean, positiveNumber, text } from "@/lib/capability-validation";
import { GOAL_COOKIE, goalHref, parseGoal } from "@/lib/start/goal";
import { parseRating, START_MATERIALS, START_PROCESSES, processName } from "@/lib/start/capability";
import type { MaterialCode, ProcessCode } from "@/lib/opportunities/types";

/**
 * Server Actions for the guided start (Path A and Path B). They write through the signed-in user's own session, so the same
 * Row Level Security, owner rule and audit as the pages they replace apply. Nothing here uses the service role or any AI.
 */

const back = (path: string, code: string): never => redirect(`${path}?error=${code}`);

export async function chooseGoal(fd: FormData): Promise<void> {
  await requireOrganization();
  const goal = parseGoal(clean(fd.get("goal")));
  if (!goal) return back("/start", "choose");
  (await cookies()).set(GOAL_COOKIE, goal, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect(goalHref(goal));
}

/** Path A: save one product (no factory needed) with its material and size as specifications and an optional unverified HS claim. */
export async function startProduct(fd: FormData): Promise<void> {
  const { organization } = await requireOrganization();
  if (organization.role !== "owner") return back("/start/a", "not_owner");
  const name = text(fd.get("name"), { min: 2, max: 200, required: true });
  const use = text(fd.get("intendedUse"), { max: 500 });
  const description = text(fd.get("description"), { max: 2000, long: true });
  const weightKg = positiveNumber(fd.get("weightKg"), { max: 999999 });
  if (!name.ok || !use.ok || !description.ok || !weightKg.ok) return back("/start/a", "invalid");
  const hs = clean(fd.get("hsCode")).replace(/\s+/g, "");
  if (hs !== "" && !/^\d{4}([.]?\d{2}){0,3}$/.test(hs)) return back("/start/a", "invalid_hs");
  const material = clean(fd.get("material"));
  const size = text(fd.get("size"), { max: 100 });
  if (!size.ok) return back("/start/a", "invalid");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .insert({
      organization_id: organization.id,
      name: name.value,
      intended_use: use.value,
      description: description.value,
      unit_weight_g: weightKg.value === null ? null : Math.round(weightKg.value * 1000 * 100) / 100,
      hs_code_claimed: hs === "" ? null : hs,
    })
    .select("id")
    .single();
  if (error || !data) return back("/start/a", "failed");
  const id = data.id as string;

  const specs: { name: string; value_text: string }[] = [];
  if (material && material !== "unknown") specs.push({ name: "Material", value_text: material });
  if (size.value) specs.push({ name: "Size (mm)", value_text: size.value });
  for (const s of specs) await supabase.from("product_specifications").insert({ organization_id: organization.id, product_id: id, ...s });

  redirect(`/workspace/${id}`);
}

/**
 * Path B: register the factory (location is needed to save it) with the processes, materials and machines the person chose,
 * then open the opportunity they picked. A failure after the factory exists leaves the factory in place and sends the person on.
 */
export async function startFactory(fd: FormData): Promise<void> {
  const { organization } = await requireOrganization();
  if (organization.role !== "owner") return back("/start/b", "not_owner");
  const checked = validateFactory({
    factoryName: fd.get("factoryName"),
    addressLine1: fd.get("addressLine1"),
    city: fd.get("city"),
    state: fd.get("state"),
    postalCode: fd.get("postalCode"),
  });
  if (!checked.ok) return back("/start/b", "factory_invalid");
  const v = checked.values;

  const processes = fd.getAll("process").map(String).filter((c): c is ProcessCode => START_PROCESSES.some((p) => p.code === c));
  const materials = fd.getAll("material").map(String).filter((c): c is MaterialCode => START_MATERIALS.some((m) => m.code === c));
  const machines = fd.getAll("machine").map(String).flatMap((raw) => {
    const [code, ...rest] = raw.split("|");
    return START_PROCESSES.some((p) => p.code === code) ? [{ code: code as ProcessCode, size: rest.join("|").slice(0, 100) }] : [];
  });
  const pick = clean(fd.get("opportunity"));

  const supabase = await createClient();
  const { data: factory, error } = await supabase
    .from("factories")
    .insert({ organization_id: organization.id, name: v.factoryName, address_line1: v.addressLine1, city: v.city, state: v.state, postal_code: v.postalCode })
    .select("id")
    .single();
  if (error || !factory) return back("/start/b", "failed");
  const factoryId = factory.id as string;

  const ref = await getReferenceData();
  const pid = (c: string) => ref.processes.find((p) => p.code === c)?.id ?? null;
  const mid = (c: string) => ref.materials.find((m) => m.code === c)?.id ?? null;

  for (const code of new Set(processes)) {
    const id = pid(code);
    if (id) await supabase.from("factory_processes").insert({ organization_id: organization.id, factory_id: factoryId, scope: "process", process_id: id });
  }
  for (const code of new Set(materials)) {
    const id = mid(code);
    if (id) await supabase.from("factory_materials").insert({ organization_id: organization.id, factory_id: factoryId, material_id: id });
  }
  for (const m of machines) {
    const rating = parseRating(m.size);
    await supabase.from("machines").insert({
      organization_id: organization.id,
      factory_id: factoryId,
      name: `${processName(m.code)} machine`,
      quantity: 1,
      process_id: pid(m.code),
      rating_value: rating?.value ?? null,
      rating_unit: rating?.unit ?? null,
    });
  }

  redirect(/^[a-z0-9-]{2,60}$/.test(pick) ? `/opportunities/${pick}` : "/opportunities");
}
