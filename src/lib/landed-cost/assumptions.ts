import type { Assessment } from "./assessment.ts";
import type { LineKey } from "./types.ts";

/**
 * Which starting values are still SAMPLES, and which the person has replaced, confirmed or explicitly accepted.
 * Preparing the cost estimate is only "complete" when no relevant assumption is still an unexamined sample.
 */

export type AssumptionStatus = "entered" | "confirmed" | "from_product" | "accepted" | "sample";

export interface Assumption {
  path: string;
  label: string;
  status: AssumptionStatus;
}

const LINES: [LineKey, string][] = [
  ["packaging", "Packaging cost"],
  ["inlandFreight", "Inland freight"],
  ["exportHandling", "Export handling"],
  ["internationalFreight", "International freight"],
  ["insurance", "Insurance"],
  ["destinationClearing", "Destination clearing"],
];

/** The fields a person should look at before trusting a landed-cost figure. */
export function relevantAssumptions(a: Pick<Assessment, "inputs" | "edited" | "acceptedSamples">, productProvided: string[] = []): Assumption[] {
  const edited = new Set(a.edited);
  const accepted = new Set(a.acceptedSamples);
  const status = (path: string, confirmed = false, alsoEdited: string[] = []): AssumptionStatus => {
    if (confirmed) return "confirmed";
    if (edited.has(path) || alsoEdited.some((p) => edited.has(p))) return "entered";
    if (productProvided.includes(path)) return "from_product";
    if (accepted.has(path)) return "accepted";
    return "sample";
  };
  const out: Assumption[] = [
    { path: "quantity", label: "Quantity", status: status("quantity", false, ["quantityUnit"]) },
    { path: "unitProductionCostInr", label: "Unit production cost", status: status("unitProductionCostInr") },
    { path: "sellingPriceAed", label: "Selling price", status: status("sellingPriceAed") },
    { path: "inrPerAed", label: "Exchange rate", status: status("inrPerAed") },
    { path: "duty.ratePercent", label: "Customs duty rate", status: status("duty.ratePercent") },
    { path: "unitsPerCarton", label: "Units per carton", status: status("unitsPerCarton") },
    { path: "cartonGrossWeightKg", label: "Carton gross weight", status: status("cartonGrossWeightKg") },
  ];
  for (const [key, label] of LINES) {
    const p = `lines.${key}.amount`;
    out.push({ path: p, label, status: status(p, a.inputs.lines[key].confirmed, [`lines.${key}.basis`, `lines.${key}.currency`]) });
  }
  return out;
}

export interface AssumptionSummary {
  total: number;
  samples: Assumption[];
  entered: number;
  confirmed: number;
  accepted: number;
  fromProduct: number;
  /** True only when no relevant assumption is an unexamined sample. */
  complete: boolean;
}

export function summariseAssumptions(a: Pick<Assessment, "inputs" | "edited" | "acceptedSamples">, productProvided: string[] = []): AssumptionSummary {
  const all = relevantAssumptions(a, productProvided);
  const count = (s: AssumptionStatus) => all.filter((x) => x.status === s).length;
  const samples = all.filter((x) => x.status === "sample");
  return { total: all.length, samples, entered: count("entered"), confirmed: count("confirmed"), accepted: count("accepted"), fromProduct: count("from_product"), complete: samples.length === 0 };
}

/** The product-record fields that were used as starting values, from what the workspace facts say is recorded. */
export function productProvidedFields(p: { unitsPerCarton: number | null; cartonWeightKg: number | null; cartonDims: boolean } | null): string[] {
  if (!p) return [];
  const out: string[] = [];
  if (p.unitsPerCarton !== null) out.push("unitsPerCarton");
  if (p.cartonWeightKg !== null) out.push("cartonGrossWeightKg");
  return out;
}
