import { fmtUsd } from "../trade/format.ts";
import type { EntryEvidence } from "../trade/evidence.ts";
import type { MatchResult } from "../opportunities/types.ts";
import type { CatalogueEntry } from "../opportunities/types.ts";
import { PROCESS_NAMES } from "../opportunities/engine.ts";

/**
 * The deterministic explanation of a recommendation. It is always available (no AI needed) and is built
 * only from the manufacturer's saved data, the rules engine, the trade-data snapshot and the
 * manufacturer's own assumptions. It keeps four things apart on purpose, and never merges them:
 *   manufacturing fit | UAE trade evidence | commercial feasibility | regulatory readiness
 */

export type Provenance = "user" | "inferred" | "reported" | "assumption" | "missing" | "unknown";

export interface Commercial {
  landedPerUnitAed: number;
  sellingPriceAed: number;
  grossMarginPct: number | null;
  targetMarginPct: number;
  /** True while the calculator still holds sample values. */
  sample: boolean;
}

export interface Dimension {
  key: "fit" | "evidence" | "commercial" | "regulatory";
  title: string;
  status: string;
  provenance: Provenance;
  lines: string[];
}

export interface ProductExplanation {
  dimensions: Dimension[];
  why: string[];
  uncertain: string[];
  plausible: { verdict: "plausible" | "partly" | "stretch" | "unknown"; text: string };
}

export function explainProduct(args: {
  entry: CatalogueEntry | null;
  match: MatchResult | null;
  commercial: Commercial | null;
  screening: { total: number; resolved: number };
  evidence: EntryEvidence;
}): ProductExplanation {
  const { entry, match, commercial, screening } = args;
  const ev = args.evidence;

  // ---- manufacturing fit
  const fit: Dimension = { key: "fit", title: "Manufacturing fit", status: "Not assessed", provenance: "missing", lines: [] };
  if (entry && match) {
    fit.status = `${match.level === "stretch" ? "Stretch" : match.level[0].toUpperCase() + match.level.slice(1)} fit, ${match.score}/100 on capability only`;
    fit.provenance = "inferred";
    fit.lines.push(...match.reasons);
    if (match.missingProcesses.length) fit.lines.push(`Needs ${match.missingProcesses.map((p) => PROCESS_NAMES[p].toLowerCase()).join(" and ")}, which you have not declared.`);
    fit.lines.push(`Tooling to confirm: ${entry.tooling.slice(0, 2).join("; ")}.`);
    fit.lines.push("Unverified: that your machines, moulds and tolerances can actually meet the specification. Only a toolmaker or trial run can confirm that.");
  } else fit.lines.push("There is no rules profile for this product type, so manufacturing fit has not been assessed.");

  // ---- UAE trade evidence
  const evd: Dimension = { key: "evidence", title: "UAE demand evidence", status: ev.loaded ? "No data for this product type" : "Not loaded in this deployment", provenance: "missing", lines: [] };
  if (ev.hasData) {
    evd.provenance = "reported";
    evd.status = "Reported trade data for broad HS headings (dated snapshot)";
    for (const h of ev.headings) {
      if (h.latestUae) evd.lines.push(`HS ${h.heading} (${h.label}): the UAE reported ${fmtUsd(h.latestUae.valueUsd)} of imports from all countries in ${h.latestUae.year}.`);
      if (h.latestIndia) evd.lines.push(`India reported ${fmtUsd(h.latestIndia.valueUsd)} of exports to the UAE under HS ${h.heading} in ${h.latestIndia.year}.`);
    }
    evd.lines.push("This is market evidence for a broad heading. It is not demand for this product, not buyer intent and not a forecast.");
  } else evd.lines.push(ev.loaded ? "No reported trade data is available for this product type, so there is no evidence either way." : ev.emptyReason);

  // ---- commercial feasibility
  const com: Dimension = { key: "commercial", title: "Commercial feasibility", status: "Not assessed", provenance: "missing", lines: [] };
  if (commercial) {
    com.provenance = commercial.sample ? "assumption" : "user";
    com.status = commercial.sample ? "Illustrative: sample inputs" : "Based on your own assumptions";
    const m = commercial.grossMarginPct;
    com.lines.push(`Landed cost AED ${commercial.landedPerUnitAed.toFixed(2)} per unit against a proposed price of AED ${commercial.sellingPriceAed.toFixed(2)}; gross margin ${m === null ? "n/a" : `${m}%`} against a ${commercial.targetMarginPct}% target.`);
    com.lines.push(commercial.sample ? "These figures use sample values. Replace them with your own costs and quotes." : "Freight, duty and price are your estimates unless you marked them as quoted. The price is not tested against the market.");
  } else com.lines.push("No landed-cost estimate yet. Open the calculator to start one.");

  // ---- regulatory readiness
  const reg: Dimension = { key: "regulatory", title: "Regulatory readiness", status: "Not assessed", provenance: "unknown", lines: [] };
  reg.lines.push(
    screening.total > 0
      ? `${screening.resolved} of ${screening.total} screening questions marked as answered by you. None has been verified against an official source.`
      : "No screening questions apply because the product type is unknown.",
  );
  reg.lines.push("UAE requirements, the duty rate, HS classification and CEPA eligibility are all unverified. This platform does not assess compliance.");

  const why: string[] = [];
  if (match && entry) {
    if (match.matchedProcesses.length) why.push(`Your declared ${match.matchedProcesses.map((p) => PROCESS_NAMES[p].toLowerCase()).join(" and ")} support it.`);
    if (match.putsToWork.length) why.push(`It would put your ${match.putsToWork.map((p) => PROCESS_NAMES[p].toLowerCase()).join(" and ")} capability to work, which none of your current products uses.`);
    if (match.matchedMaterials.length) why.push(`You already work with ${match.matchedMaterials.join(", ")}.`);
    why.push(...entry.whyUae.map((w) => w.replace(/ \((?:hypothesis|to be assessed)[^)]*\)\.?$/i, ".")));
  }
  if (ev.hasData) why.push("The UAE reports meaningful trade in the related HS heading (see the evidence panel).");

  const uncertain = [
    "Whether a UAE buyer would pay your price.",
    "Which technical requirements and tests the UAE would apply to this product.",
    "The correct HS code, and therefore the duty and origin position.",
    ...(commercial?.sample ? ["Every commercial figure, because the calculator still holds sample values."] : []),
    ...(match?.gaps.slice(0, 2) ?? []),
  ];

  const plausible: ProductExplanation["plausible"] = !match
    ? { verdict: "unknown", text: "There is not enough information to say whether your factory could make this." }
    : match.level === "stretch"
      ? { verdict: "stretch", text: "Not with the processes you have declared. It would need new capability." }
      : match.level === "possible"
        ? { verdict: "partly", text: "Partly. Some of what it needs is declared, with gaps to close first." }
        : { verdict: "plausible", text: "Plausibly, on what you have declared. That is an inference from your profile, not a technical confirmation." };

  return { dimensions: [fit, evd, com, reg], why, uncertain, plausible };
}
