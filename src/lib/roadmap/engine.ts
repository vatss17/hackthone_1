import { calculate, validateInputs } from "../landed-cost/calc.ts";
import type { Assessment } from "../landed-cost/assessment.ts";
import type { DocumentStatus } from "../documents/generate.ts";
import type { ExpertRequest, TaskStatus, WorkspaceFacts } from "../workspace/types.ts";

/**
 * The personalised export-readiness roadmap. A pure function of what is actually known:
 * the factory profile, the product record, the capability match, the landed-cost assessment, the
 * screening questions the person has worked through, the document drafts and the expert requests.
 * Nothing is a fixed checklist: tasks appear, change status and reorder as that information changes.
 *
 * Honesty rules:
 *  - A task the data can prove is marked from the data. A task only a person can know is manual.
 *  - A person may mark any task completed. That records their progress and is NEVER treated as a
 *    regulatory approval. If the saved data does not back a "completed" mark, the task says it is
 *    resting on the person's word (support = "assumption").
 *  - There is no readiness percentage. Progress is shown as counts, and blockers are listed.
 */

export type Priority = "high" | "medium" | "low";
export type Support = "data" | "assumption" | "unknown";

export interface RoadmapTask {
  id: string;
  phase: 1 | 2 | 3 | 4 | 5;
  title: string;
  why: string;
  next: { label: string; href: string };
  priority: Priority;
  status: TaskStatus;
  /** Where the status came from: the saved data, or the person's own mark. */
  statusSource: "data" | "you";
  support: Support;
  /** One line saying what backs the status, or why nothing can. */
  supportNote: string;
  /** Only a person can know it (no data can show it). */
  manual: boolean;
  /** Outstanding, and stops a sound decision until resolved. */
  blocker: boolean;
  /** Shown on regulatory tasks: marking them done is not an approval. */
  disclaimer?: string;
  note: string;
}

export interface RoadmapInput {
  facts: WorkspaceFacts;
  assessment: Assessment | null;
  docs: DocumentStatus;
  requests: ExpertRequest[];
}

export interface Roadmap {
  phases: { id: 1 | 2 | 3 | 4 | 5; title: string; blurb: string; tasks: RoadmapTask[]; counts: { total: number; completed: number; needsReview: number } }[];
  tasks: RoadmapTask[];
  next: { task: RoadmapTask; reason: string } | null;
  blockers: RoadmapTask[];
  counts: { total: number; completed: number; inProgress: number; needsReview: number; notStarted: number; resting: number };
}

export const PHASES: { id: 1 | 2 | 3 | 4 | 5; title: string; blurb: string }[] = [
  { id: 1, title: "Confirm product and manufacturing feasibility", blurb: "Be sure what you are exporting and that your factory can make it." },
  { id: 2, title: "Validate market and commercial assumptions", blurb: "Replace sample numbers with your own and test whether the economics hold." },
  { id: 3, title: "Resolve regulations and incentives", blurb: "Settle the open questions on classification, requirements, origin and schemes." },
  { id: 4, title: "Prepare shipment and export documents", blurb: "Complete the draft documents once the facts are settled." },
  { id: 5, title: "Coordinate execution", blurb: "Line up experts, partners and terms for a first shipment." },
];

const REG_DISCLAIMER = "Marking this done records your progress. It is not an approval and does not mean any requirement is met.";

type Auto = { status: TaskStatus; support: Support; supportNote: string };
type Def = Omit<RoadmapTask, "status" | "statusSource" | "support" | "supportNote" | "note"> & { auto: Auto };

const ratio = (done: number, total: number): TaskStatus => (total === 0 ? "not_started" : done === 0 ? "not_started" : done >= total ? "completed" : "in_progress");

function ticked(a: Assessment | null, ids: string[]): number {
  return a ? ids.filter((id) => a.checks[id]).length : 0;
}

export function buildRoadmap(input: RoadmapInput): Roadmap {
  const { facts, assessment: a, docs, requests } = input;
  const p = facts.product;
  const ref = facts.ref;
  const q = facts.questions;
  const defs: Def[] = [];
  const add = (d: Def) => defs.push(d);

  const valid = !!a && Object.keys(validateInputs(a.inputs).errors).length === 0;
  const result = valid ? calculate(a!.inputs) : null;
  const edited = !!a && a.edited.length > 0;
  const calcHref = facts.standalone ? "/viability" : `/viability?product=${ref}`;
  const withRef = (path: string) => (facts.standalone ? path : `${path}?product=${ref}`);

  // ---------------- phase 1 ----------------
  if (!facts.standalone && p && !p.own) {
    add({ id: "p1-adopt", phase: 1, title: "Add this product to your catalogue", why: "It is a suggestion from your capabilities, not yet a product you make. Adding it lets the platform use your own specifications.", next: { label: "Add the product", href: "/products/new" }, priority: "high", manual: false, blocker: false, auto: { status: "not_started", support: "data", supportNote: "A suggested product is not in your catalogue." } });
  }
  if (p?.own) {
    const parts = [p.description, p.category, p.intendedUse, p.specCount > 0].filter(Boolean).length;
    add({ id: "p1-record", phase: 1, title: "Complete the product record", why: "Description, category, intended use and specifications feed the match, the screening and the documents.", next: { label: "Open the product", href: `/products/${ref}` }, priority: "high", manual: false, blocker: parts < 4, auto: { status: ratio(parts, 4), support: "data", supportNote: `${parts} of 4 record parts present.` } });
    add({ id: "p1-link", phase: 1, title: "Link the product to the factory that makes it", why: "Linking is how the platform knows where it is made and judges manufacturing fit.", next: { label: "Link a factory", href: `/products/${ref}#factories` }, priority: "high", manual: false, blocker: false, auto: { status: p.linkedFactories.length > 0 ? "completed" : "not_started", support: "data", supportNote: p.linkedFactories.length > 0 ? `Linked to ${p.linkedFactories.join(", ")}.` : "Not linked to any factory." } });
  }
  if (facts.fit.level === null) {
    add({ id: "p1-fit", phase: 1, title: "Confirm what kind of product this is", why: "There is no rules profile for this product type, so manufacturing fit has not been assessed.", next: { label: "Ask for a review", href: `/services?topic=review${facts.standalone ? "" : `&product=${ref}`}` }, priority: "medium", manual: true, blocker: false, auto: { status: "not_started", support: "unknown", supportNote: "No capability score exists. Only a person can judge fit." } });
  } else {
    const level = facts.fit.level;
    const gaps = facts.fit.gaps.length;
    const status: TaskStatus = level === "stretch" ? "needs_review" : gaps === 0 && (level === "strong" || level === "good") ? "completed" : gaps > 0 ? "in_progress" : "needs_review";
    add({ id: "p1-fit", phase: 1, title: level === "stretch" ? "Decide whether to invest in a new process" : "Review manufacturing fit and close the gaps", why: level === "stretch" ? "This product needs a process you have not declared. That is a major decision." : `${gaps} gap${gaps === 1 ? "" : "s"} in your profile for this product.`, next: { label: "See the match and gaps", href: `/opportunities/${ref}#match` }, priority: level === "stretch" || gaps > 0 ? "high" : "medium", manual: false, blocker: level === "stretch", auto: { status, support: "data", supportNote: `Rule-based fit: ${facts.fit.score}/100 (${level}). Inferred from what you declared.` } });
  }
  if (facts.profile.machines > 0 && facts.profile.ratedMachines < facts.profile.machines) {
    add({ id: "p1-ratings", phase: 1, title: "Add ratings to your machines", why: "Press size and screw diameter firm up the capability match.", next: { label: "Open the factory profile", href: "/factories" }, priority: "low", manual: false, blocker: false, auto: { status: ratio(facts.profile.ratedMachines, facts.profile.machines), support: "data", supportNote: `${facts.profile.ratedMachines} of ${facts.profile.machines} machine types rated.` } });
  }
  const cartonKnown = !!(p?.cartonWeightKg && p.cartonDims) || (!!a && (a.edited.includes("cartonGrossWeightKg") || a.edited.includes("cartonLengthMm")));
  add({ id: "p1-carton", phase: 1, title: "Record your carton weight and size", why: "Freight is often charged by weight or volume, so the cost depends on how you pack.", next: { label: "Open the calculator", href: `${calcHref}#inputs` }, priority: "medium", manual: false, blocker: false, auto: { status: cartonKnown ? "completed" : "not_started", support: cartonKnown ? "data" : "assumption", supportNote: cartonKnown ? "Carton data is recorded." : "The calculator is using sample carton data." } });

  // ---------------- phase 2 ----------------
  add({ id: "p2-inputs", phase: 2, title: "Replace the sample inputs with your own costs and price", why: "Until you do, every margin and landed-cost figure is illustrative.", next: { label: "Edit the calculator", href: `${calcHref}#inputs` }, priority: "high", manual: false, blocker: !edited, auto: { status: edited ? "completed" : "not_started", support: edited ? "data" : "assumption", supportNote: edited ? "You have entered your own values." : "Still sample values." } });
  const freightOk = !!a?.inputs.lines.internationalFreight.confirmed;
  add({ id: "p2-freight", phase: 2, title: "Get a freight quote and mark it confirmed", why: "International freight is usually the most uncertain logistics cost.", next: { label: "Open the calculator", href: `${calcHref}#inputs` }, priority: "high", manual: false, blocker: false, auto: { status: freightOk ? "completed" : "not_started", support: freightOk ? "data" : "assumption", supportNote: freightOk ? "You hold a quote for freight." : "Freight is an estimate." } });
  const fxOk = !!a && a.inputs.fxNote.trim().length > 0;
  add({ id: "p2-fx", phase: 2, title: "Note the source and date of your exchange rate", why: "The rate is typed by you. A noted source makes it checkable.", next: { label: "Open the calculator", href: `${calcHref}#inputs` }, priority: "low", manual: false, blocker: false, auto: { status: fxOk ? "completed" : "not_started", support: fxOk ? "data" : "assumption", supportNote: fxOk ? "Source noted." : "No source noted." } });
  if (a && valid) {
    const money = (["packaging", "inlandFreight", "exportHandling", "internationalFreight", "insurance", "destinationClearing", "otherDestination", "otherCharges"] as const).filter((k) => a.inputs.lines[k].amount > 0);
    const confirmed = money.filter((k) => a.inputs.lines[k].confirmed).length;
    add({ id: "p2-quotes", phase: 2, title: "Get quotes for the other charges", why: "Each confirmed charge removes an estimate from the landed cost.", next: { label: "Open the calculator", href: `${calcHref}#inputs` }, priority: "medium", manual: false, blocker: false, auto: { status: ratio(confirmed, money.length), support: confirmed === money.length && money.length > 0 ? "data" : "assumption", supportNote: `${confirmed} of ${money.length} charges confirmed by a quote.` } });
  }
  {
    const target = a?.inputs.targetMarginPercent ?? 20;
    let auto: Auto = { status: "not_started", support: "assumption", supportNote: "No landed-cost estimate yet." };
    if (result) {
      const m = result.grossMarginPct ?? 0;
      const below = result.grossProfitInr < 0 || m < target;
      auto = !edited
        ? { status: "not_started", support: "assumption", supportNote: "The estimate uses sample inputs." }
        : below
          ? { status: "needs_review", support: "assumption", supportNote: `Gross margin ${m}% is below your ${target}% target at your assumptions.` }
          : { status: "completed", support: "assumption", supportNote: `Gross margin ${m}% meets your ${target}% target at your assumptions. The selling price is not tested against the market.` };
    }
    add({ id: "p2-margin", phase: 2, title: "Check the margin and compare scenarios", why: "Shows which variables make this viable or unattractive.", next: { label: "Compare scenarios", href: `${calcHref}#scenarios` }, priority: "high", manual: false, blocker: auto.status === "needs_review", auto });
  }
  add({ id: "p2-market", phase: 2, title: "Test your selling price against real UAE evidence", why: "No market data is connected, so your price has not been tested. Talk to importers or distributors.", next: { label: "Ask for market guidance", href: `/services?topic=review${facts.standalone ? "" : `&product=${ref}`}` }, priority: "medium", manual: true, blocker: false, auto: { status: "not_started", support: "unknown", supportNote: "Only a person can show this. The platform has no market data." } });

  // ---------------- phase 3 ----------------
  const hs = !!p?.hsCode;
  add({ id: "p3-hs", phase: 3, title: "Confirm the HS classification", why: "Duty, origin and many requirements all depend on the product code.", next: { label: "Ask an expert", href: `/services?topic=hs${facts.standalone ? "" : `&product=${ref}`}` }, priority: "high", manual: true, blocker: true, disclaimer: REG_DISCLAIMER, auto: { status: hs ? "in_progress" : "not_started", support: "unknown", supportNote: hs ? `You claim ${p!.hsCode}. It is unverified.` : "No code recorded. Only a classifier or customs authority can settle it." } });
  if (q.compliance.length > 0) {
    const n = ticked(a, q.compliance);
    add({ id: "p3-reqs", phase: 3, title: "Work through the Indian export and UAE import questions", why: "These are the open questions on what the product and importer must meet.", next: { label: "Open the screening", href: withRef("/compliance") }, priority: "high", manual: false, blocker: n < q.compliance.length, disclaimer: REG_DISCLAIMER, auto: { status: ratio(n, q.compliance.length), support: "unknown", supportNote: `${n} of ${q.compliance.length} marked resolved by you. The platform has verified none of them.` } });
    const nt = ticked(a, q.testing);
    add({ id: "p3-testing", phase: 3, title: "Settle the testing and certification evidence", why: "Buyers and authorities may ask for test reports and declarations.", next: { label: "Open the testing questions", href: `${withRef("/compliance")}#testing` }, priority: "medium", manual: false, blocker: false, disclaimer: REG_DISCLAIMER, auto: { status: ratio(nt, q.testing.length), support: "unknown", supportNote: `${nt} of ${q.testing.length} marked resolved by you.` } });
  }
  add({ id: "p3-duty", phase: 3, title: "Confirm the UAE customs duty for your tariff line", why: "The calculator's duty rate is an unverified assumption.", next: { label: "Ask an expert", href: `/services?topic=hs${facts.standalone ? "" : `&product=${ref}`}` }, priority: "medium", manual: true, blocker: false, disclaimer: REG_DISCLAIMER, auto: { status: "not_started", support: "assumption", supportNote: `The calculator uses ${a?.inputs.duty.ratePercent ?? 5}% as an assumption.` } });
  if (q.cepa.length > 0) {
    const n = ticked(a, q.cepa);
    add({ id: "p3-cepa", phase: 3, title: "Assess origin for the CEPA preference", why: "Preferential duty depends on meeting origin rules. It has not been checked.", next: { label: "Open the origin questions", href: `${withRef("/schemes")}#cepa` }, priority: "medium", manual: false, blocker: false, disclaimer: REG_DISCLAIMER, auto: { status: ratio(n, q.cepa.length), support: "unknown", supportNote: `${n} of ${q.cepa.length} marked resolved by you. Eligibility is not determined here.` } });
    const ns = ticked(a, q.schemes);
    add({ id: "p3-schemes", phase: 3, title: "Investigate Indian export schemes", why: "Schemes may reduce cost. No eligibility or amount is stated here.", next: { label: "Open the schemes", href: `${withRef("/schemes")}#schemes` }, priority: "low", manual: false, blocker: false, disclaimer: REG_DISCLAIMER, auto: { status: ratio(ns, q.schemes.length), support: "unknown", supportNote: `${ns} of ${q.schemes.length} marked resolved by you.` } });
  }

  // ---------------- phase 4 ----------------
  const docHref = facts.standalone ? "/documentation/standalone" : `/documentation/${ref}`;
  const docStatus = (d: { missing: number; total: number }): TaskStatus => (d.missing === 0 ? "completed" : d.missing >= d.total ? "not_started" : "in_progress");
  add({ id: "p4-invoice", phase: 4, title: "Complete the commercial invoice draft", why: "Buyer, terms and identifiers must come from you. The platform never invents them.", next: { label: "Open the invoice", href: `${docHref}#invoice` }, priority: "medium", manual: false, blocker: false, auto: { status: docStatus(docs.invoice), support: "data", supportNote: docs.invoice.missing === 0 ? "All required fields filled. It is still a draft for review." : `${docs.invoice.missing} required item${docs.invoice.missing === 1 ? "" : "s"} missing.` } });
  add({ id: "p4-packing", phase: 4, title: "Complete the packing list draft", why: "Weights, cartons and references must match the real shipment.", next: { label: "Open the packing list", href: `${docHref}#packing` }, priority: "medium", manual: false, blocker: false, auto: { status: docStatus(docs.packing), support: "data", supportNote: docs.packing.missing === 0 ? "All required fields filled. It is still a draft for review." : `${docs.packing.missing} required item${docs.packing.missing === 1 ? "" : "s"} missing.` } });
  add({ id: "p4-checklist", phase: 4, title: "Go through the export documentation checklist", why: "Shows what else may be asked for and who provides it.", next: { label: "Open the checklist", href: `${docHref}#checklist` }, priority: "medium", manual: false, blocker: false, auto: { status: ratio(docs.checklist.answered, docs.checklist.total), support: "unknown", supportNote: `${docs.checklist.answered} of ${docs.checklist.total} items answered. Which documents are required is not verified.` } });

  // ---------------- phase 5 ----------------
  const mine = requests.filter((r) => r.productRef === (facts.standalone ? null : ref) || r.productRef === null);
  const sent = mine.some((r) => ["sent", "answered", "closed"].includes(r.status));
  add({ id: "p5-expert", phase: 5, title: "Send your expert brief and record the answer", why: "Experts settle classification, requirements and eligibility. The brief is prepared with your context filled in.", next: { label: "Prepare a brief", href: `/services${facts.standalone ? "" : `?product=${ref}`}` }, priority: "medium", manual: false, blocker: false, auto: { status: sent ? "completed" : mine.length > 0 ? "in_progress" : "not_started", support: "data", supportNote: mine.length === 0 ? "No expert brief saved yet. Requests are local to your browser: nothing is sent to anyone by the platform." : `${mine.length} brief${mine.length === 1 ? "" : "s"} saved. You record whether you sent it.` } });
  add({ id: "p5-forwarder", phase: 5, title: "Choose a freight forwarder and customs broker", why: "They quote freight, file the declaration and handle transport documents.", next: { label: "Request freight help", href: `/services?topic=freight${facts.standalone ? "" : `&product=${ref}`}` }, priority: "low", manual: true, blocker: false, auto: { status: "not_started", support: "unknown", supportNote: "Only you can record this." } });
  add({ id: "p5-terms", phase: 5, title: "Agree price, delivery terms and payment terms with the buyer", why: "The invoice and landed-cost basis must match what you agree.", next: { label: "Check the terms in the invoice", href: `${docHref}#invoice` }, priority: "medium", manual: true, blocker: false, auto: { status: "not_started", support: "unknown", supportNote: "Only you can record this." } });
  add({ id: "p5-trial", phase: 5, title: "Plan a first, small shipment", why: "A trial shipment tests your assumptions with real costs and paperwork.", next: { label: "Review feasibility", href: facts.standalone ? "/feasibility/standalone" : `/feasibility/${ref}` }, priority: "low", manual: true, blocker: false, auto: { status: "not_started", support: "unknown", supportNote: "Only you can record this." } });

  // ---------------- merge with what the person marked ----------------
  const tasks: RoadmapTask[] = defs.map((d) => {
    const { auto, ...rest } = d;
    const user = a?.tasks[d.id];
    const status = user?.status ?? auto.status;
    let support = auto.support;
    let supportNote = auto.supportNote;
    if (user) {
      if (user.status === "completed" && auto.status !== "completed") {
        support = d.manual || auto.support === "unknown" ? "unknown" : "assumption";
        supportNote = `Marked completed by you. ${d.manual ? "Nothing in your saved data can show this." : "Your saved data does not show it yet."}`;
      } else supportNote = `Status set by you. ${auto.supportNote}`;
    }
    const open = status !== "completed";
    return { ...rest, status, statusSource: user ? "you" : "data", support, supportNote, note: user?.note ?? "", blocker: rest.blocker && open } as RoadmapTask;
  });

  const phases = PHASES.map((ph) => {
    const list = tasks.filter((t) => t.phase === ph.id);
    return { ...ph, tasks: list, counts: { total: list.length, completed: list.filter((t) => t.status === "completed").length, needsReview: list.filter((t) => t.status === "needs_review").length } };
  });
  const rank = { high: 0, medium: 1, low: 2 } as const;
  const open = tasks.filter((t) => t.status !== "completed");
  // High-priority work first, earliest phase first within a priority. Low-priority work only when nothing else is open.
  const ordered = [...open].sort((x, y) => rank[x.priority] - rank[y.priority] || x.phase - y.phase);
  const pick = ordered[0];
  const next = pick ? { task: pick, reason: `${pick.why} It is the earliest open ${pick.priority}-priority step, in phase ${pick.phase}: ${PHASES[pick.phase - 1].title.toLowerCase()}.` } : null;

  return {
    phases,
    tasks,
    next,
    blockers: tasks.filter((t) => t.blocker),
    counts: {
      total: tasks.length,
      completed: tasks.filter((t) => t.status === "completed").length,
      inProgress: tasks.filter((t) => t.status === "in_progress").length,
      needsReview: tasks.filter((t) => t.status === "needs_review").length,
      notStarted: tasks.filter((t) => t.status === "not_started").length,
      resting: tasks.filter((t) => t.status === "completed" && t.support !== "data").length,
    },
  };
}

export const STATUS_LABEL: Record<TaskStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
  needs_review: "Needs review",
};
