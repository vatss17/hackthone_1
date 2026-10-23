import { DEFAULT_SCENARIOS } from "./scenarios.ts";
import type { CostLine, Inputs, LineKey, Scenario } from "./types.ts";
import { ANSWER_STATES, DOC_KEYS, TASK_STATUSES, type ChecklistAnswer, type DocReview, type DocsState, type ScreeningAnswer, type TaskState } from "../workspace/types.ts";

/**
 * A saved local assessment: the calculator inputs, which fields the user has changed, the scenarios,
 * and which screening questions the user has marked as resolved. It lives in the user's own browser
 * (and can be exported or imported as a JSON file). No database is involved, so it is not shared
 * between devices and is not visible to other users or to us.
 *
 * Anything read back (from storage or an imported file) is treated as untrusted: it is coerced field
 * by field onto the defaults, so a damaged or hand-edited file can never produce an invalid model.
 */

export const ASSESSMENT_VERSION = 2;
/** Versions that can still be read. Older ones are migrated on read and the stored original is never deleted. */
export const READABLE_VERSIONS = [1, 2];

export interface Assessment {
  v: typeof ASSESSMENT_VERSION;
  ref: string;
  inputs: Inputs;
  /** Dotted paths of the fields the user has edited. Everything else is still a sample value. */
  edited: string[];
  /** Fields still holding their sample value that the person has explicitly accepted as they are. */
  acceptedSamples: string[];
  scenarios: Scenario[];
  /** The screening questions that are RESOLVED: answered or not applicable. Derived from `answers`. Resolved never means compliant. */
  checks: Record<string, boolean>;
  /** The recorded answer to each screening question, with notes and evidence the person typed. */
  answers: Record<string, ScreeningAnswer>;
  /** A task the person chose to focus on instead of the recommended one. */
  focusTaskId: string | null;
  /** Roadmap progress the person recorded by hand, by task id. */
  tasks: Record<string, TaskState>;
  /** Details typed into the export document drafts, and the checklist answers. */
  docs: DocsState;
  updatedAt: string;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number, min: number, max: number) => (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : fallback);
/** A finite number the person typed. Out-of-range values are KEPT so validation can show an inline error: they are never silently replaced. */
const loose = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 1e12 ? v : fallback);
const optNum = (v: unknown, fallback: number | null, max: number) => (v === null ? null : typeof v === "number" && Number.isFinite(v) && v > 0 && v <= max ? v : fallback);
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
const text = (v: unknown, fallback: string, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, max) : fallback);

const BASES = ["per_consignment", "per_unit", "per_carton", "per_kg", "per_cbm", "percent_of_goods"] as const;
const LINE_KEYS: LineKey[] = ["packaging", "inlandFreight", "exportHandling", "internationalFreight", "insurance", "destinationClearing", "otherCharges", "otherDestination"];

function coerceLine(raw: unknown, d: CostLine): CostLine {
  const r = isObj(raw) ? raw : {};
  return {
    amount: loose(r.amount, d.amount),
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
    quantity: loose(r.quantity, d.quantity),
    quantityUnit: oneOf(r.quantityUnit, ["units", "cartons"] as const, d.quantityUnit),
    unitsPerCarton: loose(r.unitsPerCarton, d.unitsPerCarton),
    cartonGrossWeightKg: "cartonGrossWeightKg" in r ? optNum(r.cartonGrossWeightKg, d.cartonGrossWeightKg, 100000) : d.cartonGrossWeightKg,
    cartonLengthMm: "cartonLengthMm" in r ? optNum(r.cartonLengthMm, d.cartonLengthMm, 100000) : d.cartonLengthMm,
    cartonWidthMm: "cartonWidthMm" in r ? optNum(r.cartonWidthMm, d.cartonWidthMm, 100000) : d.cartonWidthMm,
    partialCartonGrossKg: "partialCartonGrossKg" in r ? optNum(r.partialCartonGrossKg, null, 100000) : null,
    cartonHeightMm: "cartonHeightMm" in r ? optNum(r.cartonHeightMm, d.cartonHeightMm, 100000) : d.cartonHeightMm,
    unitProductionCostInr: loose(r.unitProductionCostInr, d.unitProductionCostInr),
    lines,
    inrPerAed: loose(r.inrPerAed, d.inrPerAed),
    fxNote: text(r.fxNote, d.fxNote, 200),
    sellingPriceAed: loose(r.sellingPriceAed, d.sellingPriceAed),
    duty: {
      ratePercent: loose(duty.ratePercent, d.duty.ratePercent),
      basis: oneOf(duty.basis, ["cif_cost", "selling_price"] as const, d.duty.basis),
      preferentialRatePercent: loose(duty.preferentialRatePercent, d.duty.preferentialRatePercent),
      applyPreference: typeof duty.applyPreference === "boolean" ? duty.applyPreference : d.duty.applyPreference,
    },
    targetMarginPercent: loose(r.targetMarginPercent, d.targetMarginPercent),
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

const ID = /^[a-z0-9._-]{1,80}$/i;

function coerceTasks(raw: unknown): Record<string, TaskState> {
  const out: Record<string, TaskState> = {};
  if (!isObj(raw)) return out;
  for (const [k, v] of Object.entries(raw).slice(0, 80)) {
    if (!ID.test(k) || !isObj(v)) continue;
    const status = TASK_STATUSES.includes(v.status as never) ? (v.status as TaskState["status"]) : null;
    const note = text(v.note, "", 300);
    if (status === null && note === "") continue;
    out[k] = { status, note, updatedAt: text(v.updatedAt, "", 40) };
  }
  return out;
}

function coerceDocs(raw: unknown): DocsState {
  const r = isObj(raw) ? raw : {};
  const details: DocsState["details"] = {};
  if (isObj(r.details)) for (const k of DOC_KEYS) if (typeof r.details[k] === "string") details[k] = text(r.details[k], "", k.endsWith("Address") ? 400 : 200);
  const checklist: Record<string, ChecklistAnswer> = {};
  if (isObj(r.checklist)) for (const [k, v] of Object.entries(r.checklist).slice(0, 60)) if (ID.test(k) && (v === "have" || v === "need" || v === "na")) checklist[k] = v;
  const review: DocsState["review"] = {};
  if (isObj(r.review)) {
    for (const k of ["invoice", "packing"] as const) {
      const v = r.review[k];
      if (isObj(v) && typeof v.by === "string" && v.by.trim()) review[k] = { by: text(v.by, "", 80), on: text(v.on, "", 40), fingerprint: text(v.fingerprint, "", 80) } satisfies DocReview;
    }
  }
  return { details, checklist, review };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function coerceAnswers(raw: unknown): Record<string, ScreeningAnswer> {
  const out: Record<string, ScreeningAnswer> = {};
  if (!isObj(raw)) return out;
  for (const [k, v] of Object.entries(raw).slice(0, 200)) {
    if (!ID.test(k) || !isObj(v) || !ANSWER_STATES.includes(v.state as never)) continue;
    const day = (x: unknown) => (typeof x === "string" && DATE.test(x) ? x : "");
    out[k] = {
      state: v.state as ScreeningAnswer["state"],
      answer: text(v.answer, "", 600),
      note: text(v.note, "", 600),
      source: text(v.source, "", 200),
      sourceDate: day(v.sourceDate),
      reviewer: text(v.reviewer, "", 80),
      reviewedOn: day(v.reviewedOn),
      answeredOn: day(v.answeredOn),
      ...(v.legacy === true ? { legacy: true } : {}),
    };
  }
  return out;
}

/**
 * A recorded answer counts as RESOLVED when it says something: an answer is written, or "not applicable" comes with the reason.
 * "Unknown" is not resolved, and a state with no text is not resolved. A tick migrated from version 1 is resolved but marked legacy.
 * Resolved NEVER means compliant: the platform does not judge the answers.
 */
export const answerResolved = (v: ScreeningAnswer): boolean => (v.legacy === true ? true : v.state === "answered" ? v.answer.trim() !== "" : v.state === "not_applicable" ? v.note.trim() !== "" : false);

export const isResolved = (a: Pick<Assessment, "answers">, id: string) => !!a.answers[id] && answerResolved(a.answers[id]);

export const resolvedMirror = (answers: Record<string, ScreeningAnswer>): Record<string, boolean> =>
  Object.fromEntries(Object.entries(answers).filter(([, v]) => answerResolved(v)).map(([k]) => [k, true]));

/**
 * Reads a saved assessment of any readable version. Version 1 files are migrated conservatively: a ticked question becomes a
 * resolved answer marked `legacy`, with no answer text invented. Nothing is deleted from the file that was read.
 */
export function parseAssessment(textValue: string, ref: string, defaults: Inputs): Assessment | null {
  let raw: unknown;
  try {
    raw = JSON.parse(textValue);
  } catch {
    return null;
  }
  if (!isObj(raw) || typeof raw.v !== "number" || !READABLE_VERSIONS.includes(raw.v)) return null;
  const answers = coerceAnswers(raw.answers);
  if (raw.v === 1 && isObj(raw.checks)) {
    for (const [k, v] of Object.entries(raw.checks).slice(0, 200)) {
      if (v === true && ID.test(k) && !answers[k]) answers[k] = { state: "answered", answer: "", note: "", source: "", sourceDate: "", reviewer: "", reviewedOn: "", answeredOn: "", legacy: true };
    }
  }
  return {
    v: ASSESSMENT_VERSION,
    ref,
    inputs: coerceInputs(raw.inputs, defaults),
    edited: Array.isArray(raw.edited) ? raw.edited.filter((e): e is string => typeof e === "string" && e.length < 60).slice(0, 80) : [],
    acceptedSamples: Array.isArray(raw.acceptedSamples) ? raw.acceptedSamples.filter((e): e is string => typeof e === "string" && e.length < 60).slice(0, 80) : [],
    scenarios: coerceScenarios(raw.scenarios),
    checks: resolvedMirror(answers),
    answers,
    focusTaskId: typeof raw.focusTaskId === "string" && ID.test(raw.focusTaskId) ? raw.focusTaskId : null,
    tasks: coerceTasks(raw.tasks),
    docs: coerceDocs(raw.docs),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt.slice(0, 40) : new Date(0).toISOString(),
  };
}

/**
 * Changes one roadmap task's saved state. A note and a status are independent: writing a note never pins the status, and
 * clearing both removes the entry. Pure, so it can be applied to the latest saved copy.
 */
export function applyTaskPatch(a: Assessment, id: string, patch: { status?: TaskState["status"]; note?: string }, now: string): Assessment {
  const before = a.tasks[id] ?? { status: null, note: "", updatedAt: "" };
  const next: TaskState = { ...before, ...patch, note: patch.note === undefined ? before.note : text(patch.note, "", 300), updatedAt: now };
  const tasks = { ...a.tasks };
  if (next.status === null && !next.note) delete tasks[id];
  else tasks[id] = next;
  return { ...a, tasks };
}

export function newAssessment(ref: string, inputs: Inputs): Assessment {
  return { v: ASSESSMENT_VERSION, ref, inputs, edited: [], acceptedSamples: [], scenarios: DEFAULT_SCENARIOS.map((s) => ({ ...s })), checks: {}, answers: {}, focusTaskId: null, tasks: {}, docs: { details: {}, checklist: {}, review: {} }, updatedAt: new Date().toISOString() };
}

/** Storage key. The company id keeps two companies on one browser apart. */
export const storageKey = (organizationId: string, ref: string, version: number = ASSESSMENT_VERSION) => `export-enablement:assessment:v${version}:${organizationId}:${ref}`;
