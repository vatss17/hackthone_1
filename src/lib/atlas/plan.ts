import type { PlanItem } from "./tools.ts";
import type { IntentId } from "./intents.ts";

/**
 * Two small records Atlas keeps in this browser, per company:
 *  - the plan: tasks the person approved from an Atlas proposal, per product;
 *  - the activity log: what Atlas ran, so the AI Workbench can show history.
 * Neither leaves the browser. Both are parsed defensively, so a damaged value never breaks a page.
 */

export interface SavedPlanItem extends PlanItem {
  ref: string;
  addedAt: string;
  done: boolean;
}

export interface Activity {
  id: string;
  at: string;
  prompt: string;
  intent: IntentId;
  ref: string | null;
  title: string;
  summary: string;
  /** "approved" or "declined" once the person answers a proposal. */
  decision: "approved" | "declined" | null;
}

export const planKey = (org: string) => `atlas:plan:v1:${org}`;
export const activityKey = (org: string) => `atlas:workbench:v1:${org}`;
export const ACTIVITY_LIMIT = 40;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max = 400) => (typeof v === "string" ? v.slice(0, max) : "");

function parseList(text: string | null): unknown[] {
  if (!text) return [];
  try {
    const v = JSON.parse(text);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function parsePlan(text: string | null): SavedPlanItem[] {
  return parseList(text)
    .filter(isObj)
    .map((r) => ({
      id: str(r.id, 120),
      ref: str(r.ref, 80),
      title: str(r.title, 200),
      why: str(r.why),
      href: str(r.href, 300).startsWith("/") ? str(r.href, 300) : "/",
      taskId: typeof r.taskId === "string" ? r.taskId.slice(0, 120) : null,
      addedAt: str(r.addedAt, 40),
      done: r.done === true,
    }))
    .filter((r) => r.id && r.ref && r.title);
}

/** Adds approved items to the plan. An item already in the plan for that product is kept as it is, never duplicated. */
export function addToPlan(plan: SavedPlanItem[], ref: string, items: PlanItem[], now: string): SavedPlanItem[] {
  const have = new Set(plan.filter((p) => p.ref === ref).map((p) => p.id));
  return [...plan, ...items.filter((i) => !have.has(i.id)).map((i) => ({ ...i, ref, addedAt: now, done: false }))];
}

export const togglePlanItem = (plan: SavedPlanItem[], ref: string, id: string): SavedPlanItem[] => plan.map((p) => (p.ref === ref && p.id === id ? { ...p, done: !p.done } : p));
export const removePlanItem = (plan: SavedPlanItem[], ref: string, id: string): SavedPlanItem[] => plan.filter((p) => !(p.ref === ref && p.id === id));

export function parseActivity(text: string | null): Activity[] {
  return parseList(text)
    .filter(isObj)
    .map((r) => ({
      id: str(r.id, 60),
      at: str(r.at, 40),
      prompt: str(r.prompt, 300),
      intent: str(r.intent, 40) as IntentId,
      ref: typeof r.ref === "string" ? r.ref.slice(0, 80) : null,
      title: str(r.title, 200),
      summary: str(r.summary, 600),
      decision: r.decision === "approved" || r.decision === "declined" ? (r.decision as Activity["decision"]) : null,
    }))
    .filter((r) => r.id && r.intent);
}

/** Newest first, capped so the log never grows without bound. */
export const logActivity = (log: Activity[], entry: Activity): Activity[] => [entry, ...log.filter((a) => a.id !== entry.id)].slice(0, ACTIVITY_LIMIT);
export const decide = (log: Activity[], id: string, decision: "approved" | "declined"): Activity[] => log.map((a) => (a.id === id ? { ...a, decision } : a));
