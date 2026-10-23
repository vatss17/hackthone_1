import { ASSESSMENT_VERSION, parseAssessment, storageKey, type Assessment } from "../landed-cost/assessment.ts";
import { sampleInputs } from "../landed-cost/defaults.ts";
import { parseRequests, requestsKey } from "../experts/brief.ts";
import type { ExpertRequest } from "./types.ts";

/**
 * One versioned file that holds a company's whole local workspace: every product's assessment (calculator inputs, screening answers,
 * roadmap progress, document drafts), the expert requests, edited expert drafts and the factory capacity notes.
 *
 * Why it exists: all of this lives in the browser that typed it. It is not on our servers, so another device or a cleared browser
 * does not have it. This file is the way to move it or keep a copy. It is NOT a backup service and NOT cross-device sync.
 *
 * Safety: a file is untrusted. It is checked field by field, it must name the SAME company as the one importing it (product ids and
 * assessments belong to one company), and restoring never silently overwrites newer local work unless the person chooses to.
 */

export const BACKUP_FORMAT = "export-enablement-workspace";
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 5_000_000;

export interface WorkspaceBackup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  /** The company this workspace belongs to. A file for another company is refused. */
  organizationId: string;
  assessments: Record<string, Assessment>;
  requests: ExpertRequest[];
  /** Edited expert briefs, by "<product or standalone>:<topic>". */
  drafts: Record<string, string>;
  /** Factory capacity notes (utilisation and confirmation), by factory id, as the JSON text the page keeps. */
  capacity: Record<string, string>;
}

/** The part of the browser's storage this module needs. */
export interface Store {
  keys(): string[];
  get(key: string): string | null;
  set(key: string, value: string): void;
}

const ASSESSMENT_PREFIX = (scope: string, v: number) => `export-enablement:assessment:v${v}:${scope}:`;
const DRAFT_PREFIX = (scope: string) => `export-enablement:expert-draft:v1:${scope}:`;
const CAPACITY_PREFIX = (scope: string) => `export-enablement:capacity:v1:${scope}:`;
const REF = /^[a-z0-9-]{1,60}$/i;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Reads everything this company has saved on this device. Older assessment versions are migrated in the copy; the stored originals are untouched. */
export function collect(store: Store, scope: string, now: Date = new Date()): WorkspaceBackup {
  const keys = store.keys();
  const assessments: Record<string, Assessment> = {};
  // Oldest version first, so a newer saved copy of the same product wins.
  for (const v of [1, ASSESSMENT_VERSION]) {
    const prefix = ASSESSMENT_PREFIX(scope, v);
    for (const k of keys.filter((x) => x.startsWith(prefix))) {
      const ref = k.slice(prefix.length);
      const raw = store.get(k);
      if (!REF.test(ref) || !raw) continue;
      const a = parseAssessment(raw, ref, sampleInputs());
      if (a) assessments[ref] = a;
    }
  }
  const drafts: Record<string, string> = {};
  for (const k of keys.filter((x) => x.startsWith(DRAFT_PREFIX(scope)))) {
    const v = store.get(k);
    if (v) drafts[k.slice(DRAFT_PREFIX(scope).length)] = v.slice(0, 8000);
  }
  const capacity: Record<string, string> = {};
  for (const k of keys.filter((x) => x.startsWith(CAPACITY_PREFIX(scope)))) {
    const v = store.get(k);
    if (v && v.length < 20000) capacity[k.slice(CAPACITY_PREFIX(scope).length)] = v;
  }
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), organizationId: scope, assessments, requests: parseRequests(store.get(requestsKey(scope))), drafts, capacity };
}

export const serialize = (b: WorkspaceBackup) => JSON.stringify(b, null, 2);

export type ParseResult = { ok: true; backup: WorkspaceBackup; warnings: string[] } | { ok: false; error: string };

export function parseBackup(text: string): ParseResult {
  if (typeof text !== "string" || text.length > MAX_BACKUP_BYTES) return { ok: false, error: "That file is too large to be a workspace file." };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "That is not a valid workspace file (it is not JSON)." };
  }
  if (!isObj(raw) || raw.format !== BACKUP_FORMAT) return { ok: false, error: "That file is not an Export Enablement workspace file." };
  if (typeof raw.version !== "number" || raw.version < 1) return { ok: false, error: "That workspace file has no version." };
  if (raw.version > BACKUP_VERSION) return { ok: false, error: `That workspace file was made by a newer version (${raw.version}). Update the app, then try again. Nothing was changed.` };
  if (typeof raw.organizationId !== "string" || !/^[a-z0-9-]{8,60}$/i.test(raw.organizationId)) return { ok: false, error: "That workspace file does not say which company it belongs to." };
  const warnings: string[] = [];
  const assessments: Record<string, Assessment> = {};
  if (isObj(raw.assessments)) {
    for (const [ref, v] of Object.entries(raw.assessments).slice(0, 300)) {
      if (!REF.test(ref)) {
        warnings.push("An entry with an invalid product reference was skipped.");
        continue;
      }
      const a = parseAssessment(JSON.stringify(v), ref, sampleInputs());
      if (a) assessments[ref] = a;
      else warnings.push(`The saved assessment for one product (${ref.slice(0, 8)}…) could not be read and was skipped.`);
    }
  }
  const drafts: Record<string, string> = {};
  if (isObj(raw.drafts)) for (const [k, v] of Object.entries(raw.drafts).slice(0, 200)) if (/^[a-z0-9-]{1,60}:[a-z]{2,20}$/i.test(k) && typeof v === "string") drafts[k] = v.slice(0, 8000);
  const capacity: Record<string, string> = {};
  if (isObj(raw.capacity)) {
    for (const [k, v] of Object.entries(raw.capacity).slice(0, 100)) {
      if (!/^[a-z0-9-]{8,60}$/i.test(k) || typeof v !== "string" || v.length > 20000) continue;
      try {
        if (isObj(JSON.parse(v))) capacity[k] = v;
      } catch {
        warnings.push("A factory capacity note could not be read and was skipped.");
      }
    }
  }
  const requests = parseRequests(JSON.stringify(Array.isArray(raw.requests) ? raw.requests : []));
  return { ok: true, backup: { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: typeof raw.exportedAt === "string" ? raw.exportedAt.slice(0, 40) : "", organizationId: raw.organizationId, assessments, requests, drafts, capacity }, warnings };
}

export interface RestorePlan {
  addAssessments: string[];
  /** Local copies the file would replace although the local copy is newer. Only happens in "replace" mode. */
  replaceNewer: string[];
  replaceOlder: string[];
  keepLocal: string[];
  addRequests: number;
  updateRequests: number;
  addDrafts: number;
  addCapacity: number;
}

export type RestoreMode = "merge" | "replace";

const time = (s: string) => (Number.isFinite(Date.parse(s)) ? Date.parse(s) : 0);

/** Works out what restoring would do, without doing it. "merge" never overwrites newer local work; "replace" does, and says so. */
export function planRestore(local: WorkspaceBackup, incoming: WorkspaceBackup, mode: RestoreMode): RestorePlan {
  const plan: RestorePlan = { addAssessments: [], replaceNewer: [], replaceOlder: [], keepLocal: [], addRequests: 0, updateRequests: 0, addDrafts: 0, addCapacity: 0 };
  for (const [ref, a] of Object.entries(incoming.assessments)) {
    const mine = local.assessments[ref];
    if (!mine) plan.addAssessments.push(ref);
    else if (time(a.updatedAt) > time(mine.updatedAt)) plan.replaceOlder.push(ref);
    else if (mode === "replace") plan.replaceNewer.push(ref);
    else plan.keepLocal.push(ref);
  }
  const mineById = new Map(local.requests.map((r) => [r.id, r]));
  for (const r of incoming.requests) {
    const mine = mineById.get(r.id);
    if (!mine) plan.addRequests++;
    else if (time(r.updatedAt) > time(mine.updatedAt) || mode === "replace") plan.updateRequests++;
  }
  plan.addDrafts = Object.keys(incoming.drafts).filter((k) => mode === "replace" || !(k in local.drafts)).length;
  plan.addCapacity = Object.keys(incoming.capacity).filter((k) => mode === "replace" || !(k in local.capacity)).length;
  return plan;
}

/** Performs the restore. Refuses a file for another company. Never deletes anything: it only adds or replaces. */
export function applyRestore(store: Store, scope: string, incoming: WorkspaceBackup, mode: RestoreMode, now: Date = new Date()): { ok: true; plan: RestorePlan } | { ok: false; error: string } {
  if (incoming.organizationId !== scope) return { ok: false, error: "That workspace file belongs to a different company, so it was not imported. Sign in to that company to import it." };
  const local = collect(store, scope, now);
  const plan = planRestore(local, incoming, mode);
  const writeAssessments = [...plan.addAssessments, ...plan.replaceOlder, ...plan.replaceNewer];
  for (const ref of writeAssessments) store.set(storageKey(scope, ref), JSON.stringify(incoming.assessments[ref]));
  if (incoming.requests.length > 0) {
    const byId = new Map(local.requests.map((r) => [r.id, r]));
    for (const r of incoming.requests) {
      const mine = byId.get(r.id);
      if (!mine || time(r.updatedAt) > time(mine.updatedAt) || mode === "replace") byId.set(r.id, r);
    }
    const merged = [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100);
    store.set(requestsKey(scope), JSON.stringify(merged));
  }
  for (const [k, v] of Object.entries(incoming.drafts)) if (mode === "replace" || !(k in local.drafts)) store.set(`${DRAFT_PREFIX(scope)}${k}`, v);
  for (const [k, v] of Object.entries(incoming.capacity)) if (mode === "replace" || !(k in local.capacity)) store.set(`${CAPACITY_PREFIX(scope)}${k}`, v);
  return { ok: true, plan };
}

export interface DeviceStatus {
  assessments: number;
  requests: number;
  drafts: number;
  /** The most recent save across all products, or null when nothing is saved here. */
  lastSaved: string | null;
}

export function deviceStatus(b: WorkspaceBackup): DeviceStatus {
  const times = [...Object.values(b.assessments).map((a) => a.updatedAt), ...b.requests.map((r) => r.updatedAt)].filter((t) => time(t) > 0).sort();
  return { assessments: Object.keys(b.assessments).length, requests: b.requests.length, drafts: Object.keys(b.drafts).length, lastSaved: times.at(-1) ?? null };
}
