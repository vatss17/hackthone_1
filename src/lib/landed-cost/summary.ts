import type { FitLevel } from "../opportunities/types.ts";
import { sensitivities } from "./calc.ts";
import type { Assessment } from "./assessment.ts";
import { calculate, validateInputs } from "./calc.ts";
import type { Inputs, Result } from "./types.ts";

/**
 * Turns the pieces of an assessment into the consultant-style first read shown on the feasibility
 * page. The wording is fixed and conservative: it never says approved, compliant or guaranteed, and
 * it always says that regulatory requirements have not been verified (until a verified rule base
 * exists, which it does not).
 */

export const TOP_LABEL: Record<string, string> = {
  price: "selling price",
  cost: "production cost",
  intlFreight: "freight",
  packaging: "packaging cost",
  fx: "the exchange rate",
  duty: "the duty rate",
};

export function topDrivers(i: Inputs, n = 2): string[] {
  const s = sensitivities(i, 10);
  const swing = new Map<string, number>();
  for (const x of s) swing.set(x.key.slice(0, -1), Math.max(swing.get(x.key.slice(0, -1)) ?? 0, Math.abs(x.deltaPp ?? 0)));
  return [...swing.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => TOP_LABEL[k] ?? k);
}

export function inputsAreSample(a: Assessment | null): boolean {
  return !a || a.edited.length === 0;
}

export interface ExecutiveSummary {
  tone: "positive" | "mixed" | "caution";
  sentences: string[];
  numbers: { label: string; value: string }[] | null;
}

export function executiveSummary(args: { fit: FitLevel | null; assessment: Assessment | null; format: { aed: (n: number) => string; pct: (n: number | null) => string } }): ExecutiveSummary {
  const { fit, assessment, format } = args;
  const manufacturing =
    fit === "strong" || fit === "good"
      ? "Promising manufacturing fit."
      : fit === "possible"
        ? "Partial manufacturing fit, with gaps to close."
        : fit === "stretch"
          ? "Making this would need a process you have not declared."
          : "Manufacturing fit has not been assessed for this product.";

  let commercial: string;
  let numbers: ExecutiveSummary["numbers"] = null;
  let tone: ExecutiveSummary["tone"] = fit === "strong" || fit === "good" ? "mixed" : "caution";
  const valid = assessment && Object.keys(validateInputs(assessment.inputs).errors).length === 0;
  if (!assessment || !valid) {
    commercial = "Commercial viability has not been estimated yet.";
  } else {
    const r: Result = calculate(assessment.inputs);
    const target = assessment.inputs.targetMarginPercent;
    const drivers = topDrivers(assessment.inputs).join(" and ");
    numbers = [
      { label: "Landed cost per unit", value: format.aed(r.landedPerUnitAed) },
      { label: "Selling price per unit", value: format.aed(assessment.inputs.sellingPriceAed) },
      { label: "Gross margin", value: format.pct(r.grossMarginPct) },
    ];
    if (inputsAreSample(assessment)) {
      commercial = `The landed-cost figures are illustrative until you replace the sample inputs with your own. Commercial viability depends on ${drivers}.`;
    } else if (r.grossProfitInr < 0) {
      commercial = `At your assumptions the export would make a loss. Commercial viability depends on ${drivers}.`;
      tone = "caution";
    } else if ((r.grossMarginPct ?? 0) < target) {
      commercial = `At your assumptions the gross margin is ${format.pct(r.grossMarginPct)}, below your ${target}% target. Commercial viability depends on ${drivers}.`;
    } else {
      commercial = `At your assumptions the gross margin is ${format.pct(r.grossMarginPct)}, at or above your ${target}% target. Commercial viability depends on ${drivers}.`;
      if (tone === "mixed") tone = "positive";
    }
  }
  const regulatory = "UAE regulatory requirements have not yet been verified.";
  return { tone, sentences: [manufacturing, commercial, regulatory], numbers };
}

export interface MissingItem {
  id: string;
  label: string;
  why: string;
  href: string;
  kind: "missing" | "assumption" | "unknown";
}

export function missingInformation(args: { assessment: Assessment | null; hsClaimed: boolean; capabilityGaps: number; ref: string }): MissingItem[] {
  const { assessment, hsClaimed, capabilityGaps, ref } = args;
  const items: MissingItem[] = [];
  const edited = new Set(assessment?.edited ?? []);
  const i = assessment?.inputs;
  const calc = `/viability?product=${ref}`;
  if (!assessment || edited.size === 0) items.push({ id: "own-inputs", label: "Your own cost and price inputs", why: "The calculator still holds sample values, so the numbers are illustrative.", href: calc, kind: "assumption" });
  if (!i || !i.fxNote.trim()) items.push({ id: "fx", label: "Exchange rate source and date", why: "The INR per AED rate is user-entered. Note where it came from and when.", href: `${calc}#inputs`, kind: "assumption" });
  if (!i || !i.lines.internationalFreight.confirmed) items.push({ id: "freight", label: "A freight quote", why: "International freight is the most uncertain logistics cost until you hold a quote.", href: `${calc}#inputs`, kind: "assumption" });
  items.push({ id: "duty", label: "Customs duty for your product code", why: "The duty rate in the calculator is an unverified assumption.", href: `/compliance?product=${ref}`, kind: "unknown" });
  items.push({ id: "hs", label: hsClaimed ? "Confirmation of your claimed HS code" : "An HS code, then its confirmation", why: "Duty, rules of origin and some requirements all depend on classification.", href: `/compliance?product=${ref}#hs`, kind: "unknown" });
  items.push({ id: "uae-reqs", label: "UAE import requirements for this product", why: "No requirement has been verified against official sources.", href: `/compliance?product=${ref}`, kind: "unknown" });
  items.push({ id: "cepa", label: "Whether CEPA preferential duty could apply", why: "Eligibility depends on rules of origin and classification. It has not been checked.", href: `/schemes?product=${ref}`, kind: "unknown" });
  items.push({ id: "demand", label: "Verified UAE demand and price levels", why: "No market data is connected, so your selling price is untested against the market.", href: `/opportunities/${ref}?stage=4`, kind: "missing" });
  if (capabilityGaps > 0) items.push({ id: "gaps", label: `${capabilityGaps} gap${capabilityGaps === 1 ? "" : "s"} in your factory profile for this product`, why: "Closing them makes the manufacturing assessment firmer.", href: "/factories", kind: "missing" });
  if (i && (i.cartonGrossWeightKg === null || i.cartonLengthMm === null)) items.push({ id: "carton", label: "Carton weight and dimensions", why: "Needed to cost freight by weight or volume.", href: `${calc}#inputs`, kind: "missing" });
  return items;
}

export interface NextAction {
  label: string;
  href: string;
  done: boolean;
  note: string;
}

export function nextActions(args: { assessment: Assessment | null; ref: string; checksResolved: number; checksTotal: number }): NextAction[] {
  const { assessment, ref, checksResolved, checksTotal } = args;
  const hasOwn = !!assessment && assessment.edited.length > 0;
  return [
    { label: "Replace the sample inputs with your own costs and price", href: `/viability?product=${ref}#inputs`, done: hasOwn, note: "Makes the margin meaningful." },
    { label: "Get a freight quote and mark it confirmed", href: `/viability?product=${ref}#inputs`, done: !!assessment?.inputs.lines.internationalFreight.confirmed, note: "Freight is usually the biggest swing factor." },
    { label: "Compare scenarios and find your break-even price", href: `/viability?product=${ref}#scenarios`, done: false, note: "See which variable makes this viable or not." },
    { label: "Work through the compliance screening questions", href: `/compliance?product=${ref}`, done: checksTotal > 0 && checksResolved === checksTotal, note: `${checksResolved} of ${checksTotal} marked resolved.` },
    { label: "Check the CEPA and export-scheme questions", href: `/schemes?product=${ref}`, done: false, note: "Eligibility is not determined by this platform." },
    { label: "Ask an expert to confirm classification and requirements", href: "/services", done: false, note: "Expert help is a preview today." },
  ];
}
