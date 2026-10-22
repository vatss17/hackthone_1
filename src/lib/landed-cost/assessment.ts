import { DEFAULT_SCENARIOS } from "./scenarios.ts";
import type { CostLine, Inputs, LineKey, Scenario } from "./types.ts";

/**
 * A saved local assessment: the calculator inputs, which fields the user has changed, the scenarios,
 * and which screening questions the user has marked as resolved. It lives in the user's own browser
 * (and can be exported or imported as a JSON file). No database is involved, so it is not shared
 * between devices and is not visible to other users or to us.
 *
 * Anything read back (from storage or an imported file) is treated as untrusted: it is coerced field
 * by field onto the defaults, so a damaged or hand-edited file can never produce an invalid model.
 */

export const ASSESSMENT_VERSION = 1;

export interface Assessment {
  v: typeof ASSESSMENT_VERSION;
  ref: string;
  inputs: Inputs;
  /** Dotted paths of the fields the user has edited. Everything else is still a sample value. */
  edited: string[];
  scenarios: Scenario[];
  checks: Record<string, boolean>;
  updatedAt: string;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number, min: number, max: number) => (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : fallback);
const optNum = (v: unknown, fallback: number | null, max: number) => (v === null ? null : typeof v === "number" && Number.isFinite(v) && v > 0 && v <= max ? v : fallback);
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
const text = (v: unknown, fallback: string, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, max) : fallback);

const BASES = ["per_consignment", "per_unit", "per_carton", "per_kg", "per_cbm", "percent_of_goods"] as const;
const LINE_KEYS: LineKey[] = ["packaging", "inlandFreight", "exportHandling", "internationalFreight", "insurance", "destinationClearing", "otherCharges", "otherDestination"];

function coerceLine(raw: unknown, d: CostLine): CostLine {
  const r = isObj(raw) ? raw : {};
  return {
    amount: num(r.amount, d.amount, 0, 1e9),
    currency: oneOf(r.currency, ["INR", "AED"] as const, d.currency),
    basis: oneOf(r.basis, BASES, d.basis),
    confirmed: typeof r.confirmed === "boolean" ? r.confirmed : d.confirmed,
  };
}

export function coerceInputs(raw: unknown, d: Inputs): Inputs {
  const r = isObj(raw) ? raw : {};
  const rawLines = isObj(r.lines) ? r.lines : {};
  const duty = isObj(r.duty) ? r.duty : {};
  const lines = Object.fromEntries(LINE_KEYS.map((k) => [k, coerceLine(rawLines[k], d.lines[k])])) as Record<LineKey, CostLine>;
  return {
    productLabel: text(r.productLabel, d.productLabel, 120),
    quantity: num(r.quantity, d.quantity, 1, 1e8),
    quantityUnit: oneOf(r.quantityUnit, ["units", "cartons"] as const, d.quantityUnit),
    unitsPerCarton: num(r.unitsPerCarton, d.unitsPerCarton, 1, 1e6),
    cartonGrossWeightKg: "cartonGrossWeightKg" in r ? optNum(r.cartonGrossWeightKg, d.cartonGrossWeightKg, 100000) : d.cartonGrossWeightKg,
    cartonLengthMm: "cartonLengthMm" in r ? optNum(r.cartonLengthMm, d.cartonLengthMm, 100000) : d.cartonLengthMm,
    cartonWidthMm: "cartonWidthMm" in r ? optNum(r.cartonWidthMm, d.cartonWidthMm, 100000) : d.cartonWidthMm,
    cartonHeightMm: "cartonHeightMm" in r ? optNum(r.cartonHeightMm, d.cartonHeightMm, 100000) : d.cartonHeightMm,
    unitProductionCostInr: num(r.unitProductionCostInr, d.unitProductionCostInr, 0, 1e9),
    lines,
    inrPerAed: num(r.inrPerAed, d.inrPerAed, 0.0001, 1000),
    fxNote: text(r.fxNote, d.fxNote, 200),
    sellingPriceAed: num(r.sellingPriceAed, d.sellingPriceAed, 0, 1e9),
    duty: {
      ratePercent: num(duty.ratePercent, d.duty.ratePercent, 0, 100),
      basis: oneOf(duty.basis, ["cif_cost", "selling_price"] as const, d.duty.basis),
      preferentialRatePercent: num(duty.preferentialRatePercent, d.duty.preferentialRatePercent, 0, 100),
      applyPreference: typeof duty.applyPreference === "boolean" ? duty.applyPreference : d.duty.applyPreference,
    },
    targetMarginPercent: num(r.targetMarginPercent, d.targetMarginPercent, 0, 99.99),
  };
}

function coerceScenarios(raw: unknown): Scenario[] {
  const base = DEFAULT_SCENARIOS[0];
  if (!Array.isArray(raw)) return DEFAULT_SCENARIOS.map((s) => ({ ...s }));
  const out: Scenario[] = [];
  for (const item of raw.slice(0, 8)) {
    if (!isObj(item)) continue;
    const kind = oneOf(item.kind, ["base", "freight", "price", "tariff", "custom"] as const, "custom");
    out.push({
      id: text(item.id, `s${out.length}`, 40).replace(/\s/g, "-") || `s${out.length}`,
      name: text(item.name, "Scenario", 60) || "Scenario",
      kind,
      freightPct: num(item.freightPct, 0, -90, 500),
      pricePct: num(item.pricePct, 0, -90, 500),
      costPct: num(item.costPct, 0, -90, 500),
      fxPct: num(item.fxPct, 0, -50, 200),
      preferentialDuty: item.preferentialDuty === true,
    });
  }
  // exactly one base scenario, always first and always unchanged
  const withoutBase = out.filter((s) => s.kind !== "base");
  return [{ ...base }, ...withoutBase];
}

export function parseAssessment(textValue: string, ref: string, defaults: Inputs): Assessment | null {
  let raw: unknown;
  try {
    raw = JSON.parse(textValue);
  } catch {
    return null;
  }
  if (!isObj(raw) || raw.v !== ASSESSMENT_VERSION) return null;
  const checks: Record<string, boolean> = {};
  if (isObj(raw.checks)) {
    for (const [k, v] of Object.entries(raw.checks).slice(0, 200)) if (v === true && /^[a-z0-9._-]{1,80}$/i.test(k)) checks[k] = true;
  }
  return {
    v: ASSESSMENT_VERSION,
    ref,
    inputs: coerceInputs(raw.inputs, defaults),
    edited: Array.isArray(raw.edited) ? raw.edited.filter((e): e is string => typeof e === "string" && e.length < 60).slice(0, 80) : [],
    scenarios: coerceScenarios(raw.scenarios),
    checks,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt.slice(0, 40) : new Date(0).toISOString(),
  };
}

export function newAssessment(ref: string, inputs: Inputs): Assessment {
  return { v: ASSESSMENT_VERSION, ref, inputs, edited: [], scenarios: DEFAULT_SCENARIOS.map((s) => ({ ...s })), checks: {}, updatedAt: new Date().toISOString() };
}

/** Storage key. The company id keeps two companies on one browser apart. */
export const storageKey = (organizationId: string, ref: string) => `export-enablement:assessment:v${ASSESSMENT_VERSION}:${organizationId}:${ref}`;
