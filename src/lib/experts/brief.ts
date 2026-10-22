import { calculate, validateInputs } from "../landed-cost/calc.ts";
import type { Assessment } from "../landed-cost/assessment.ts";
import type { DocumentStatus } from "../documents/generate.ts";
import type { ExpertRequest, RequestStatus, RequestTopic, WorkspaceFacts } from "../workspace/types.ts";

/**
 * Expert briefs. The platform assembles the context a specialist needs so the manufacturer does not
 * retype it, and the manufacturer reviews and edits the text before doing anything with it.
 *
 * IMPORTANT: no expert is connected. A "request" here is a saved brief in the user's own browser,
 * with a status the user maintains by hand. Nothing is sent anywhere by the platform. The user
 * copies or downloads the brief and shares it themselves, with someone they choose.
 */

export const TOPICS: { id: RequestTopic; label: string; blurb: string; asks: string[]; sections: ("compliance" | "testing" | "hs" | "cepa" | "schemes")[] }[] = [
  {
    id: "hs",
    label: "HS classification",
    blurb: "Confirm the tariff classification, and with it the duty and origin rules that follow.",
    asks: ["Which 6-digit HS heading and national tariff line applies to this product?", "What UAE customs duty applies to that line?", "Is there anything about the design or use that could change the classification?"],
    sections: ["hs"],
  },
  {
    id: "regulatory",
    label: "Regulatory and testing questions",
    blurb: "Find out which UAE and Indian requirements and tests apply to this product.",
    asks: ["Which UAE or GCC technical regulations or conformity schemes apply?", "Which tests, certificates or declarations will the importer and authorities expect?", "Are there labelling, language or packaging requirements?"],
    sections: ["compliance", "testing"],
  },
  {
    id: "cepa",
    label: "CEPA and incentive eligibility",
    blurb: "Check whether the product could qualify for preferential duty or Indian export schemes.",
    asks: ["Could this product meet the origin rule that applies to its heading under the India–UAE CEPA?", "What records would prove origin, and who issues the certificate?", "Which Indian export schemes could apply, and at what current rates?"],
    sections: ["cepa", "schemes"],
  },
  {
    id: "freight",
    label: "Freight and landed-cost quotations",
    blurb: "Get real quotes to replace the estimates in your landed-cost assessment.",
    asks: ["Please quote freight (and, if offered, insurance and destination handling) for the shipment described.", "What transit time and routing do you recommend?", "What extra charges should I expect at origin and destination?"],
    sections: [],
  },
  {
    id: "documents",
    label: "Export documentation",
    blurb: "Have your draft documents and checklist reviewed before a first shipment.",
    asks: ["Please review the draft invoice and packing list details below.", "Which other documents are needed for this product and route?", "Who should file or issue each one?"],
    sections: [],
  },
  {
    id: "review",
    label: "General export-readiness review",
    blurb: "Ask a specialist to look over the whole picture and tell you what to do next.",
    asks: ["Please review this assessment and say what is missing or wrong.", "Which open question should I settle first, and with whom?", "Is this product worth a first shipment on these assumptions?"],
    sections: ["compliance", "hs", "cepa"],
  },
];

export const TOPIC_BY_ID = Object.fromEntries(TOPICS.map((t) => [t.id, t])) as Record<RequestTopic, (typeof TOPICS)[number]>;

export const STATUS_LABEL: Record<RequestStatus, string> = {
  draft: "Draft",
  ready: "Ready to share",
  sent: "Shared by you",
  answered: "Answer received",
  closed: "Closed",
};

export const LOCAL_NOTICE = "Saved in this browser only. This platform has not sent it to any expert, and no expert is connected. Copy or download the brief and share it yourself.";

const aed = (n: number) => `AED ${n.toFixed(2)}`;

export interface BriefInput {
  topic: RequestTopic;
  facts: WorkspaceFacts;
  assessment: Assessment | null;
  docs: DocumentStatus | null;
  /** Unresolved screening questions relevant to the topic, as readable text. */
  openQuestions: string[];
  /** ISO date the brief was prepared. */
  preparedOn: string;
}

export function composeBrief(i: BriefInput): { title: string; summary: string } {
  const t = TOPIC_BY_ID[i.topic];
  const { facts: f, assessment: a } = i;
  const p = f.product;
  const lines: string[] = [];
  const title = `${t.label}${p ? `: ${p.name}` : ""}`;

  lines.push(`EXPERT BRIEF (DRAFT, prepared by the exporter, not yet shared)`);
  lines.push(`Topic: ${t.label}`);
  lines.push(`Prepared: ${i.preparedOn}`);
  lines.push("");
  lines.push("WHAT I NEED");
  for (const q of t.asks) lines.push(`- ${q}`);
  lines.push("");
  lines.push("ABOUT US");
  lines.push(`Company: ${f.company.legalName || f.company.name}`);
  lines.push(`Manufacturing country: India`);
  if (f.profile.processNames.length) lines.push(`Processes: ${f.profile.processNames.join(", ")}`);
  if (f.profile.materialNames.length) lines.push(`Materials we process: ${f.profile.materialNames.join(", ")}`);
  lines.push("");
  lines.push("THE PRODUCT");
  if (p) {
    lines.push(`Name: ${p.name}`);
    if (p.details.category) lines.push(`Category: ${p.details.category}`);
    if (p.details.intendedUse) lines.push(`Intended use: ${p.details.intendedUse}`);
    if (p.details.description) lines.push(`Description: ${p.details.description.split("\n")[0].slice(0, 300)}`);
    if (p.details.materials.length) lines.push(`Materials: ${p.details.materials.join(", ")}`);
    for (const s of p.details.specs.slice(0, 10)) lines.push(`${s.name}: ${s.value}${s.unit ? ` ${s.unit}` : ""}`);
    if (p.unitWeightG) lines.push(`Unit weight: ${p.unitWeightG} g`);
    lines.push(`HS code claimed by us: ${p.hsCode ? `${p.hsCode} (unverified, please confirm)` : "none yet"}`);
  } else lines.push("No specific product selected. This is a general question.");
  lines.push("");

  if (f.fit.level) {
    lines.push("MANUFACTURING FIT (rule-based inference from our own declared data, not a technical opinion)");
    lines.push(`Fit: ${f.fit.level}, ${f.fit.score}/100`);
    for (const g of f.fit.gaps.slice(0, 4)) lines.push(`- Gap: ${g}`);
    lines.push("");
  }

  if (a && Object.keys(validateInputs(a.inputs).errors).length === 0) {
    const r = calculate(a.inputs);
    const sample = a.edited.length === 0;
    lines.push(`COMMERCIAL ASSUMPTIONS${sample ? " (SAMPLE VALUES, NOT REAL)" : " (our own estimates)"}`);
    lines.push(`Quantity: ${r.units} units in ${r.cartons} cartons`);
    lines.push(`Landed cost per unit: ${aed(r.landedPerUnitAed)}; proposed selling price: ${aed(a.inputs.sellingPriceAed)}; gross margin: ${r.grossMarginPct ?? "n/a"}%`);
    lines.push(`Exchange rate used: 1 AED = INR ${a.inputs.inrPerAed} (typed by us${a.inputs.fxNote ? `: ${a.inputs.fxNote}` : ""})`);
    lines.push(`Customs duty assumed: ${a.inputs.duty.ratePercent}% (our assumption, not verified)`);
    lines.push(`Freight: ${a.inputs.lines.internationalFreight.confirmed ? "we hold a quote" : "an estimate, no quote yet"}`);
    lines.push("");
  }

  if (i.openQuestions.length) {
    lines.push("OPEN QUESTIONS WE HAVE NOT RESOLVED");
    for (const q of i.openQuestions.slice(0, 12)) lines.push(`- ${q}`);
    lines.push("");
  }
  if (i.topic === "documents" && i.docs) {
    lines.push("DOCUMENT DRAFTS");
    lines.push(`Commercial invoice: ${i.docs.invoice.complete ? "all required fields filled" : `${i.docs.invoice.missing} required items still missing`}`);
    lines.push(`Packing list: ${i.docs.packing.complete ? "all required fields filled" : `${i.docs.packing.missing} required items still missing`}`);
    lines.push(`Checklist: ${i.docs.checklist.answered} of ${i.docs.checklist.total} items answered`);
    lines.push("");
  }
  lines.push("WHAT IS NOT VERIFIED");
  lines.push("- Nothing in this brief has been verified against an official source.");
  lines.push("- Any UAE requirement, duty rate, classification or eligibility mentioned is a question, not a finding.");
  lines.push("");
  lines.push("This brief contains business information. Share it only with an expert you trust.");
  return { title, summary: lines.join("\n") };
}

// ---- local storage of requests ---------------------------------------------------------------

const TOPIC_IDS = TOPICS.map((t) => t.id);
const STATUSES: RequestStatus[] = ["draft", "ready", "sent", "answered", "closed"];
const ID = /^[a-z0-9-]{6,60}$/i;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").slice(0, max) : "");

/** Reads saved requests. Treats the stored text as untrusted. */
export function parseRequests(textValue: string | null): ExpertRequest[] {
  if (!textValue) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(textValue);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const out: ExpertRequest[] = [];
  for (const r of raw.slice(0, 100)) {
    if (typeof r !== "object" || r === null) continue;
    const o = r as Record<string, unknown>;
    if (typeof o.id !== "string" || !ID.test(o.id) || !TOPIC_IDS.includes(o.topic as RequestTopic) || !STATUSES.includes(o.status as RequestStatus)) continue;
    out.push({
      id: o.id,
      topic: o.topic as RequestTopic,
      productRef: typeof o.productRef === "string" && /^[a-z0-9-]{1,60}$/i.test(o.productRef) ? o.productRef : null,
      productName: o.productName === null ? null : str(o.productName, 200) || null,
      title: str(o.title, 200) || "Expert brief",
      summary: str(o.summary, 8000),
      status: o.status as RequestStatus,
      reply: str(o.reply, 4000),
      createdAt: str(o.createdAt, 40),
      updatedAt: str(o.updatedAt, 40),
    });
  }
  return out;
}

export const requestsKey = (organizationId: string) => `export-enablement:requests:v1:${organizationId}`;
