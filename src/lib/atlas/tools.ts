import { calculate, validateInputs } from "../landed-cost/calc.ts";
import { productProvidedFields, summariseAssumptions } from "../landed-cost/assumptions.ts";
import type { Assessment } from "../landed-cost/assessment.ts";
import type { Inputs } from "../landed-cost/types.ts";
import { checklistFor, documentStatus, invoiceModel, type DocContext } from "../documents/generate.ts";
import { buildRoadmap, type Roadmap, type RoadmapTask } from "../roadmap/engine.ts";
import { RESEARCH, RESEARCH_AS_OF, type ResearchSource } from "../research/answers.ts";
import { familyById, itemsFor } from "../compliance/content.ts";
import type { ExpertRequest, WorkspaceFacts } from "../workspace/types.ts";
import type { FitLevel } from "../opportunities/types.ts";
import type { IntentId } from "./intents.ts";
import { interpolate, type Vars } from "../i18n/translate.ts";

/**
 * The tools Atlas AI runs. Each one is a pure function over data the platform already holds: the factory
 * profile and opportunity engine (from the server), and the saved assessment, documents and expert briefs
 * (from this browser). They never invent a figure, a buyer, an approval or a source: every number comes
 * from an existing engine, and every citation is one already stored with a researched answer.
 */

export type Evidence = "inferred" | "estimate" | "ai" | "secondary" | "user" | "missing" | "draft";

export interface Opportunity {
  id: string;
  name: string;
  summary: string;
  fit: FitLevel;
  score: number;
  reasons: string[];
  gaps: string[];
  missingProcesses: string[];
  putsToWork: string[];
  /** Illustrative placeholder from the catalogue, never a measurement. */
  demand: "broad" | "moderate" | "niche";
}

/** What the server knows about the company, its factories and its opportunities. */
export interface AtlasBase {
  company: string;
  profile: { processes: string[]; materials: string[]; factories: number; machines: number; thin: boolean };
  catalogueSize: number;
  yourProducts: { ref: string; name: string; recognisedAs: string | null; fit: FitLevel | null; score: number | null }[];
  opportunities: Opportunity[];
  stretchCount: number;
  products: { id: string; name: string }[];
}

/** One product: the server's facts plus what this browser has saved for it. */
export interface AtlasProduct {
  ref: string;
  name: string;
  facts: WorkspaceFacts;
  defaults: Inputs;
  assessment: Assessment | null;
  requests: ExpertRequest[];
}

export interface ToolStep {
  label: string;
  detail: string;
}

export type Section =
  | { kind: "rows"; heading: string; rows: { label: string; value: string; tone?: "good" | "bad" | "warn" }[] }
  | { kind: "list"; heading: string; items: { title: string; body?: string; href?: string; tone?: "good" | "bad" | "warn" }[] }
  | { kind: "table"; heading: string; columns: string[]; rows: string[][] };

export interface PlanItem {
  id: string;
  title: string;
  why: string;
  href: string;
  /** A roadmap task id when the item is one of the roadmap's own steps. */
  taskId: string | null;
}

export interface Proposal {
  kind: "add_to_plan";
  ref: string;
  title: string;
  items: PlanItem[];
}

export interface ToolResult {
  intent: IntentId;
  title: string;
  summary: string;
  steps: ToolStep[];
  sections: Section[];
  citations: ResearchSource[];
  evidence: Evidence[];
  links: { label: string; href: string }[];
  proposal: Proposal | null;
  /** What this answer is not. Always shown. */
  caveat: string;
}

/**
 * Turns an English source sentence into the person's language. Every user-visible sentence below is written as a translator call with {placeholders},
 * so numbers and product names are passed in as values and can never be changed by a translation. The default keeps English.
 */
export type Translator = (source: string, vars?: Vars) => string;
export const identityT: Translator = (source, vars) => interpolate(source, vars);

const fitWord = (t: Translator, fit: FitLevel, lower = false): string => {
  if (lower) return fit === "strong" ? t("strong fit") : fit === "good" ? t("good fit") : fit === "possible" ? t("possible fit") : t("stretch");
  return fit === "strong" ? t("Strong fit") : fit === "good" ? t("Good fit") : fit === "possible" ? t("Possible fit") : t("Stretch");
};
const demandWord = (t: Translator, d: Opportunity["demand"]): string => (d === "broad" ? t("broad") : d === "moderate" ? t("moderate") : t("niche"));
const confidenceWord = (t: Translator, c: "high" | "medium" | "low"): string => (c === "high" ? t("high") : c === "medium" ? t("medium") : t("low"));
const aed = (n: number) => `AED ${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const inr = (n: number) => `INR ${Math.round(n).toLocaleString("en-IN")}`;
const pct = (t: Translator, n: number | null) => (n === null ? t("n/a") : `${n.toFixed(1)}%`);
/** Picks the already-translated singular or plural phrase (each is a full translator call). */
const pl = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function docContext(p: Pick<AtlasProduct, "facts" | "defaults" | "assessment">): DocContext {
  const a = p.assessment;
  const prod = p.facts.product;
  return {
    company: p.facts.company,
    product: prod ? { name: prod.name, description: prod.details.description, hsCode: prod.hsCode, unitWeightG: prod.unitWeightG } : null,
    inputs: a?.inputs ?? p.defaults,
    inputsAreSample: !a || a.edited.length === 0,
    details: a?.docs.details ?? {},
  };
}

export function roadmapFor(p: AtlasProduct): Roadmap {
  const docs = documentStatus(docContext(p), p.facts.questions.family, p.assessment?.docs.checklist ?? {}, p.assessment?.docs.review ?? {});
  const requests = p.requests.filter((r) => r.productRef === null || r.productRef === (p.facts.standalone ? null : p.facts.ref));
  return buildRoadmap({ facts: p.facts, assessment: p.assessment, docs, requests });
}

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;
/** Open steps in the order they matter: blockers, then priority, then journey phase. */
export function openTasksInOrder(r: Roadmap): RoadmapTask[] {
  return r.tasks
    .filter((t) => t.status !== "completed")
    .sort((a, b) => Number(b.blocker) - Number(a.blocker) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.phase - b.phase);
}

// ---------------------------------------------------------------- tools

export function findOpportunities(base: AtlasBase, t: Translator = identityT): ToolResult {
  const nOpp = base.opportunities.length;
  const products = pl(nOpp, t("{count} product", { count: nOpp }), t("{count} products", { count: nOpp }));
  const { factories: nf, processes, materials, machines: nm } = base.profile;
  const profileDetail = [
    pl(nf, t("{count} factory", { count: nf }), t("{count} factories", { count: nf })),
    pl(processes.length, t("{count} process", { count: processes.length }), t("{count} processes", { count: processes.length })),
    pl(materials.length, t("{count} material", { count: materials.length }), t("{count} materials", { count: materials.length })),
    pl(nm, t("{count} machine", { count: nm }), t("{count} machines", { count: nm })),
  ].join(", ");
  const steps: ToolStep[] = [
    { label: t("Read your factory profile"), detail: profileDetail },
    { label: t("Ran the opportunity engine"), detail: t("Matched your capabilities against {count} catalogue products", { count: base.catalogueSize }) },
    { label: t("Ranked by manufacturing fit"), detail: t("{products} you could make with what you declared, {more} more that need a new process", { products, more: base.stretchCount }) },
  ];
  const caveat = t("Fit is worked out by transparent rules from your own factory data. It is not market demand, a buyer or a price. No live trade data is used.");
  if (base.profile.thin || nOpp === 0) {
    return {
      intent: "find_opportunities",
      title: t("Your factory profile is too thin to suggest products"),
      summary: t("Add the processes, machines and materials your factory uses. Atlas needs at least one process to match products."),
      steps,
      sections: [],
      citations: [],
      evidence: ["missing"],
      links: [{ label: t("Complete my factory"), href: "/factories" }],
      proposal: null,
      caveat,
    };
  }
  const top = base.opportunities.slice(0, 5);
  return {
    intent: "find_opportunities",
    title: t("{products} your factory could make", { products }),
    summary: `${t("The strongest is {name} ({fit}, score {score}).", { name: top[0].name, fit: fitWord(t, top[0].fit, true), score: top[0].score })} ${top[0].reasons[0] ?? ""}`.trim(),
    steps,
    sections: [
      {
        kind: "list",
        heading: t("Top matches"),
        items: top.map((o) => ({
          title: `${o.name} · ${fitWord(t, o.fit)} (${o.score})`,
          body: [o.reasons[0], o.gaps.length ? t("To check: {gap}", { gap: o.gaps[0] }) : t("Nothing missing from what you declared.")].filter(Boolean).join(" "),
          href: `/opportunities/${o.id}`,
          tone: o.fit === "strong" || o.fit === "good" ? "good" : "warn",
        })),
      },
    ],
    citations: [],
    evidence: ["inferred"],
    links: [
      { label: t("Open Opportunity Studio"), href: "/opportunities" },
      { label: t("See it on the world map"), href: "/world" },
    ],
    proposal: null,
    caveat,
  };
}

export function compareOpportunities(base: AtlasBase, t: Translator = identityT): ToolResult {
  const pick = base.opportunities.slice(0, 4);
  const caveat = t("A comparison of manufacturing fit from your own data. Demand words are illustrative catalogue placeholders, not measurements.");
  if (pick.length < 2) {
    return { ...findOpportunities(base, t), intent: "compare_opportunities", title: t("Not enough opportunities to compare yet"), caveat };
  }
  const none = t("None");
  return {
    intent: "compare_opportunities",
    title: t("Comparing your top {count} opportunities", { count: pick.length }),
    summary: `${t("{name} leads on fit.", { name: pick[0].name })} ${t("{count} of {total} need nothing you have not declared.", { count: pick.filter((o) => o.gaps.length === 0).length, total: pick.length })}`,
    steps: [
      { label: t("Read the opportunity engine's ranking"), detail: t("{count} candidates", { count: base.opportunities.length }) },
      { label: t("Lined up fit, reuse and gaps"), detail: t("Top {count} by score", { count: pick.length }) },
    ],
    sections: [
      {
        kind: "table",
        heading: t("Side by side"),
        columns: [t("Product"), t("Fit"), t("Uses idle capability"), t("Gaps"), t("Demand (illustrative)")],
        rows: pick.map((o) => [o.name, `${fitWord(t, o.fit)} · ${o.score}`, o.putsToWork.length ? o.putsToWork.join(", ") : none, o.gaps.length ? String(o.gaps.length) : none, demandWord(t, o.demand)]),
      },
      {
        kind: "list",
        heading: t("What would have to change"),
        items: pick.map((o) => ({ title: o.name, body: o.gaps.length ? o.gaps.slice(0, 2).join(" ") : t("Nothing from your declared profile."), href: `/opportunities/${o.id}` })),
      },
    ],
    citations: [],
    evidence: ["inferred"],
    links: [{ label: t("Open Opportunity Studio"), href: "/opportunities" }],
    proposal: null,
    caveat,
  };
}

export function explainBlockers(p: AtlasProduct, t: Translator = identityT): ToolResult {
  const r = roadmapFor(p);
  const blockers = r.blockers;
  return {
    intent: "explain_blockers",
    title: blockers.length
      ? t("{things} stopping {name} from exporting", { things: pl(blockers.length, t("{count} thing", { count: blockers.length }), t("{count} things", { count: blockers.length })), name: p.name })
      : t("Nothing is blocking {name} right now", { name: p.name }),
    summary: r.next ? t("Do this next: {task}. {reason}", { task: t(r.next.task.title), reason: t(r.next.reason) }) : t("Every step on the roadmap is done."),
    steps: [
      { label: t("Loaded your saved work"), detail: p.assessment ? t("Assessment last saved {date}", { date: p.assessment.updatedAt.slice(0, 10) }) : t("No saved assessment yet: sample values") },
      { label: t("Built the readiness roadmap"), detail: t("{total} steps across {phases} phases, {done} done", { total: r.counts.total, phases: r.phases.length, done: r.counts.completed }) },
      { label: t("Found the blockers"), detail: t("{open} open, {review} waiting for review", { open: blockers.length, review: r.counts.needsReview }) },
    ],
    sections: blockers.length
      ? [{ kind: "list", heading: t("Blockers"), items: blockers.map((b) => ({ title: t(b.title), body: t(b.why), href: b.next.href, tone: b.demonstrated ? "bad" : "warn" })) }]
      : [],
    citations: [],
    evidence: ["inferred", ...(p.assessment && p.assessment.edited.length ? (["user"] as Evidence[]) : [])],
    links: [
      { label: t("Open Mission Control"), href: `/mission/${p.ref}` },
      ...(r.next ? [{ label: t(r.next.task.next.label), href: r.next.task.next.href }] : []),
    ],
    proposal: null,
    caveat: t("A blocker is a gap in what is known or a problem your own numbers show. Clearing one records your progress; it is never a regulatory approval."),
  };
}

export function landedCost(p: AtlasProduct, t: Translator = identityT): ToolResult {
  const inputs = p.assessment?.inputs ?? p.defaults;
  const errors = Object.keys(validateInputs(inputs).errors);
  const calcHref = p.facts.standalone ? "/viability" : `/viability?product=${p.ref}`;
  const sample = !p.assessment || p.assessment.edited.length === 0;
  const caveat = t("An estimate from the assumptions shown, not a quote. Freight, duty and charges must be confirmed with a forwarder and customs broker.");
  if (errors.length) {
    return {
      intent: "calculate_landed_cost",
      title: t("The calculator has values it cannot use"),
      summary: t("Fix {fields} in the calculator first: {list}.", { fields: pl(errors.length, t("{count} field", { count: errors.length }), t("{count} fields", { count: errors.length })), list: errors.slice(0, 3).join(", ") }),
      steps: [{ label: t("Validated your inputs"), detail: t("{count} invalid", { count: errors.length }) }],
      sections: [],
      citations: [],
      evidence: ["missing"],
      links: [{ label: t("Open the calculator"), href: calcHref }],
      proposal: null,
      caveat,
    };
  }
  const res = calculate(inputs);
  const sum = p.assessment ? summariseAssumptions(p.assessment, productProvidedFields(p.facts.product ? { unitsPerCarton: p.facts.product.unitsPerCarton, cartonWeightKg: p.facts.product.cartonWeightKg, cartonDims: p.facts.product.cartonDims } : null)) : null;
  const freight = res.lines.filter((l) => l.group === "International" || l.group === "Origin logistics").reduce((s, l) => s + l.totalInr, 0);
  const loss = res.grossProfitInr < 0;
  const target = inputs.targetMarginPercent;
  return {
    intent: "calculate_landed_cost",
    title: t("Landed cost of {name}: {amount} a unit", { name: p.name, amount: aed(res.landedPerUnitAed) }),
    summary: loss
      ? t("At {price} you lose {loss} a unit. Break-even is {breakeven}.", { price: aed(inputs.sellingPriceAed), loss: aed(Math.abs(res.profitPerUnitAed)), breakeven: aed(res.breakEvenPriceAed) })
      : `${t("At {price} the gross margin is {margin} against your {target}% target.", { price: aed(inputs.sellingPriceAed), margin: pct(t, res.grossMarginPct), target })}${res.priceForTargetMarginAed ? ` ${t("The target needs {price}.", { price: aed(res.priceForTargetMarginAed) })}` : ""}`,
    steps: [
      { label: t("Read your saved assessment"), detail: sample ? t("No edits yet: every value is a sample") : t("{count} values you entered", { count: p.assessment!.edited.length }) },
      { label: t("Validated the inputs"), detail: t("All fields usable") },
      { label: t("Ran the landed-cost engine"), detail: t("{units} units in {cartons} cartons, {lines} cost lines", { units: res.units.toLocaleString("en-IN"), cartons: res.cartons.toLocaleString("en-IN"), lines: res.lines.length }) },
    ],
    sections: [
      {
        kind: "rows",
        heading: t("Result"),
        rows: [
          { label: t("Landed cost per unit"), value: aed(res.landedPerUnitAed) },
          { label: t("Selling price per unit"), value: aed(inputs.sellingPriceAed) },
          { label: t("Gross margin"), value: pct(t, res.grossMarginPct), tone: loss ? "bad" : res.grossMarginPct !== null && res.grossMarginPct >= target ? "good" : "warn" },
          { label: t("Break-even price"), value: aed(res.breakEvenPriceAed) },
          { label: t("Total landed cost"), value: inr(res.totalCostInr) },
          { label: t("Logistics and freight"), value: t("{amount} ({share}% of cost)", { amount: inr(freight), share: res.totalCostInr ? ((freight / res.totalCostInr) * 100).toFixed(1) : "0" }) },
          { label: t("Duty"), value: t("{amount} at {rate}%", { amount: inr(res.dutyInr), rate: res.dutyRateApplied }) },
          { label: t("Confirmed charges"), value: t("{share}% of cost", { share: res.confirmedSharePct.toFixed(0) }) },
        ],
      },
      ...(sum && sum.samples.length
        ? [{ kind: "list" as const, heading: t("Still sample values"), items: sum.samples.slice(0, 5).map((s) => ({ title: t(s.label), body: t("Replace it, or accept it as it is, in the calculator."), href: calcHref, tone: "warn" as const })) }]
        : []),
    ],
    citations: [],
    evidence: ["estimate", ...(sample ? [] : (["user"] as Evidence[]))],
    links: [
      { label: t("Open Export Economics"), href: calcHref },
      { label: t("Try a what-if"), href: `/what-if/${p.ref}` },
    ],
    proposal: null,
    caveat: sample ? `${caveat} ${t("Every value here is still a sample.")}` : caveat,
  };
}

export function prepareInvoice(p: AtlasProduct, t: Translator = identityT): ToolResult {
  const inv = invoiceModel(docContext(p));
  const filled = inv.totalFields - inv.missing.length;
  const moreCount = inv.missing.length - 4;
  const stillEmpty = inv.missing.slice(0, 4).map((m) => t(m)).join(", ") + (moreCount > 0 ? ` ${t("and {count} more", { count: moreCount })}` : "");
  return {
    intent: "prepare_invoice",
    title: inv.complete ? t("Your commercial invoice draft has every required field") : t("Commercial invoice draft: {filled} of {total} fields filled", { filled, total: inv.totalFields }),
    summary: inv.missing.length ? t("Still empty: {list}. Atlas never fills buyer or identifier fields for you.", { list: stillEmpty }) : t("Total {total}. Review it before it goes anywhere.", { total: inv.totalText }),
    steps: [
      { label: t("Read your company and product records"), detail: p.facts.company.address ? t("Seller name and address prefilled") : t("No factory address on file") },
      {
        label: t("Pulled quantities and price from the calculator"),
        detail: inv.line ? t("{quantity} {unit} at {price}", { quantity: inv.line.quantity.toLocaleString("en-IN"), unit: inv.line.unit, price: `${inv.currency} ${inv.line.unitPrice}` }) : t("No usable line"),
      },
      { label: t("Checked required fields"), detail: t("{missing} missing, {review} to review", { missing: inv.missing.length, review: inv.review.length }) },
    ],
    sections: [
      {
        kind: "rows",
        heading: t("Draft"),
        rows: Object.values(inv.fields)
          .filter((f) => f.required)
          .slice(0, 12)
          .map((f) => ({ label: t(f.label), value: f.value || t("Missing"), tone: f.value ? undefined : ("bad" as const) })),
      },
      ...(inv.review.length ? [{ kind: "list" as const, heading: t("Look at before using"), items: inv.review.map((r) => ({ title: t(r), tone: "warn" as const })) }] : []),
    ],
    citations: [],
    evidence: ["draft", ...(inv.missing.length ? (["missing"] as Evidence[]) : [])],
    links: [{ label: t("Open Document Studio"), href: `/documentation/${p.ref}` }],
    proposal: null,
    caveat: `${inv.label}. ${t("A draft to check, not a document anyone has issued. Atlas files and sends nothing.")}`,
  };
}

export function missingDocuments(p: AtlasProduct, t: Translator = identityT): ToolResult {
  const ctx = docContext(p);
  const answers = p.assessment?.docs.checklist ?? {};
  const status = documentStatus(ctx, p.facts.questions.family, answers, p.assessment?.docs.review ?? {});
  const items = checklistFor(p.facts.questions.family);
  const need = items.filter((i) => answers[i.id] === "need");
  const unanswered = items.filter((i) => !answers[i.id]);
  const have = items.filter((i) => answers[i.id] === "have");
  const open = need.length + unanswered.length;
  const row = (i: (typeof items)[number], tone: "bad" | "warn") => ({ title: t(i.title), body: t("{why} From: {who}.", { why: t(i.why), who: t(i.who) }), tone });
  return {
    intent: "missing_documents",
    title: t("{docs} still open for {name}", { docs: pl(open, t("{count} document", { count: open }), t("{count} documents", { count: open })), name: p.name }),
    summary: t("{have} you have, {need} you said you need, {unanswered} not checked yet. Invoice draft: {invoice} fields missing. Packing list: {packing} missing.", {
      have: have.length,
      need: need.length,
      unanswered: unanswered.length,
      invoice: status.invoice.missing,
      packing: status.packing.missing,
    }),
    steps: [
      { label: t("Loaded the document checklist"), detail: t("{count} documents for this product family", { count: items.length }) },
      { label: t("Read your answers"), detail: t("{answered} of {total} answered", { answered: status.checklist.answered, total: status.checklist.total }) },
      {
        label: t("Checked both drafts"),
        detail: t("Invoice {invoice}, packing list {packing}", {
          invoice: status.invoice.complete ? t("complete") : t("incomplete"),
          packing: status.packing.complete ? t("complete") : t("incomplete"),
        }),
      },
    ],
    sections: [
      { kind: "list", heading: t("You said you need"), items: need.map((i) => row(i, "bad")) },
      { kind: "list", heading: t("Not checked yet"), items: unanswered.map((i) => row(i, "warn")) },
    ].filter((s) => s.items.length > 0) as Section[],
    citations: [],
    evidence: ["inferred", ...(open ? (["missing"] as Evidence[]) : [])],
    links: [{ label: t("Open Document Studio"), href: `/documentation/${p.ref}` }],
    proposal: null,
    caveat: t("This checklist lists documents commonly asked for. Which ones your buyer, forwarder and customs need must be confirmed with them."),
  };
}

export function nextTasks(p: AtlasProduct, count = 5, t: Translator = identityT): ToolResult {
  const r = roadmapFor(p);
  const open = openTasksInOrder(r).slice(0, count);
  const n = open.length;
  const tasks = pl(n, t("{count} task", { count: n }), t("{count} tasks", { count: n }));
  return {
    intent: "create_next_tasks",
    title: n ? t("Your next {tasks} for {name}", { tasks, name: p.name }) : t("There is nothing left to plan"),
    summary: n ? t("Blockers first, then by priority and journey phase. Approve to add them to your plan in Mission Control.") : t("Every roadmap step is done."),
    steps: [
      { label: t("Built the readiness roadmap"), detail: t("{total} steps, {done} done", { total: r.counts.total, done: r.counts.completed }) },
      { label: t("Ordered what is open"), detail: t("{count} blockers first", { count: r.blockers.length }) },
      { label: t("Drafted your plan"), detail: t("{count} tasks, waiting for your approval", { count: n }) },
    ],
    sections: n ? [{ kind: "list", heading: t("Proposed tasks"), items: open.map((task, i) => ({ title: `${i + 1}. ${t(task.title)}`, body: t(task.why), href: task.next.href, tone: task.blocker ? "warn" : undefined })) }] : [],
    citations: [],
    evidence: ["inferred"],
    links: [{ label: t("Open Mission Control"), href: `/mission/${p.ref}` }],
    // The saved plan items keep the English record text (they are data kept in this browser); only what is shown above is translated.
    proposal: n ? { kind: "add_to_plan", ref: p.ref, title: t("Add {items} to your plan", { items: tasks }), items: open.map((task) => ({ id: `task:${task.id}`, title: task.title, why: task.why, href: task.next.href, taskId: task.id })) } : null,
    caveat: t("Adding a task to your plan changes nothing else. You still mark progress yourself."),
  };
}

export function applySchemes(p: AtlasProduct, t: Translator = identityT): ToolResult {
  const family = familyById(p.facts.questions.family);
  const items = family ? itemsFor(family, "schemes") : [];
  const href = p.facts.standalone ? "/schemes" : `/schemes?product=${p.ref}`;
  const found = items.map((i) => ({ item: i, research: RESEARCH[i.id] ?? null }));
  const citations = new Map<string, ResearchSource>();
  for (const f of found) for (const s of f.research?.sources ?? []) citations.set(s.url, s);
  const n = found.length;
  return {
    intent: "apply_schemes",
    title: n ? t("{schemes} worth checking for {name}", { schemes: pl(n, t("{count} scheme", { count: n }), t("{count} schemes", { count: n })), name: p.name }) : t("Atlas does not know this product's family yet"),
    summary: n ? t("Researched answers with sources, as of {date}. Atlas prepares the steps; you or your adviser apply. Nothing is submitted.", { date: RESEARCH_AS_OF }) : t("Recognise the product (or link it to a catalogue product) so Atlas can list the schemes that apply."),
    steps: [
      { label: t("Found the product family"), detail: family ? t(family.name) : t("Not recognised") },
      { label: t("Looked up researched answers"), detail: t("{count} of {total} have a researched answer", { count: found.filter((f) => f.research).length, total: n }) },
      { label: t("Drafted the application steps"), detail: t("{count} steps, waiting for your approval", { count: n }) },
    ],
    sections: n
      ? [
          {
            kind: "list",
            heading: t("Schemes"),
            items: found.map((f) => ({
              title: t(f.item.text),
              body: f.research ? t("{answer} Confidence: {confidence}. Confirm: {confirm}", { answer: f.research.answer, confidence: confidenceWord(t, f.research.confidence), confirm: f.research.whatToConfirm }) : t(f.item.why),
              href,
            })),
          },
        ]
      : [],
    citations: [...citations.values()].slice(0, 8),
    evidence: ["ai", "secondary"],
    links: [{ label: t("Open Benefits Studio"), href }, { label: t("Open Scheme Finder"), href: "/schemes/finder" }],
    proposal: n
      ? {
          kind: "add_to_plan",
          ref: p.ref,
          title: t("Add {items} to your plan", { items: pl(n, t("{count} scheme step", { count: n }), t("{count} scheme steps", { count: n })) }),
          // Saved records keep the English text; see nextTasks.
          items: found.map((f) => ({ id: `scheme:${f.item.id}`, title: `Check eligibility: ${f.item.text.split(":")[0]}`, why: f.research?.whatToConfirm ?? f.item.why, href, taskId: null })),
        }
      : null,
    caveat: t("Researched drafts from public sources, not a ruling on eligibility. Rates and rules change: confirm with DGFT, the export promotion council or your adviser before you rely on them."),
  };
}

export function runTool(intent: IntentId, base: AtlasBase, product: AtlasProduct | null, t: Translator = identityT): ToolResult {
  switch (intent) {
    case "find_opportunities":
      return findOpportunities(base, t);
    case "compare_opportunities":
      return compareOpportunities(base, t);
    default:
      if (!product) throw new Error("This tool needs a product");
      if (intent === "explain_blockers") return explainBlockers(product, t);
      if (intent === "calculate_landed_cost") return landedCost(product, t);
      if (intent === "prepare_invoice") return prepareInvoice(product, t);
      if (intent === "missing_documents") return missingDocuments(product, t);
      if (intent === "create_next_tasks") return nextTasks(product, 5, t);
      return applySchemes(product, t);
  }
}
