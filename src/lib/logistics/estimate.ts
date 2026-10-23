import { AED_PER_USD, CONTAINERS, LCL_MAX_CBM, LOGISTICS_AS_OF, REF, STUFFING_EFFICIENCY, USD_INR, USD_INR_AS_OF, type Quality, type RefRange, type RefSource } from "./reference.ts";

/**
 * The AI logistics estimate: from the size and weight of the consignment it plans the shipment (which containers, or a shared load),
 * prices each logistics charge from researched reference rates, and returns a low, typical and high figure with its reasoning, confidence
 * and sources. It estimates; it never confirms. Every figure is a planning number to replace with a quote.
 *
 * This is deterministic arithmetic over dated reference data (see reference.ts), so the same consignment always gives the same answer.
 * A live AI provider replaces the reference table with retrieved rates and keeps this same shape.
 */

export type Scenario = "low" | "typical" | "high";
export type EstimateKey = "inlandFreight" | "exportHandling" | "internationalFreight" | "insurance" | "destinationClearing" | "otherDestination";
export type Confidence = "medium" | "low";

export interface EstimateInput {
  volumeCbm: number | null;
  grossKg: number | null;
  /** Road distance from the factory to the departure port, in kilometres. */
  distanceKm: number;
  usdInr?: number;
}

export interface EstimateLine {
  key: EstimateKey;
  label: string;
  currency: "INR" | "AED";
  basis: "per_consignment" | "percent_of_goods";
  low: number;
  typical: number;
  high: number;
  confidence: Confidence;
  quality: Quality;
  how: string;
  sources: RefSource[];
}

export interface Plan {
  mode: "FCL" | "LCL";
  containers: { type: "20GP" | "40GP"; count: number }[];
  summary: string;
}

export interface Estimate {
  ok: boolean;
  problem?: string;
  plan: Plan;
  lines: EstimateLine[];
  usdInr: number;
  /** The market INR-per-AED rate implied by the USD rate and the fixed AED peg. A suggestion, never applied silently. */
  inrPerAed: number;
  asOf: string;
}

const EMPTY_PLAN: Plan = { mode: "FCL", containers: [], summary: "" };
const roundTo = (n: number, step: number) => Math.round(n / step) * step;

/** Cheapest set of 20ft and 40ft containers that holds the volume (at a realistic fill) and the weight. */
export function planShipment(volumeCbm: number, grossKg: number): Plan {
  const need = volumeCbm / STUFFING_EFFICIENCY;
  let best: { n20: number; n40: number; cost: number } | null = null;
  for (let n20 = 0; n20 <= 6; n20++) {
    for (let n40 = 0; n40 <= 4; n40++) {
      if (n20 + n40 === 0) continue;
      const cbm = n20 * CONTAINERS["20GP"].cbm + n40 * CONTAINERS["40GP"].cbm;
      const kg = n20 * CONTAINERS["20GP"].payloadKg + n40 * CONTAINERS["40GP"].payloadKg;
      if (cbm < need || kg < grossKg) continue;
      const cost = n20 * REF.ocean20.typical + n40 * REF.ocean40.typical;
      if (!best || cost < best.cost - 1e-9 || (Math.abs(cost - best.cost) < 1e-9 && n20 + n40 < best.n20 + best.n40)) best = { n20, n40, cost };
    }
  }
  const lclBilled = Math.max(volumeCbm, grossKg / 1000);
  const lclCost = lclBilled * REF.lcl.typical;
  if (volumeCbm <= LCL_MAX_CBM && (!best || lclCost < best.cost)) {
    return { mode: "LCL", containers: [], summary: `${volumeCbm.toFixed(1)} m³ and ${(grossKg / 1000).toFixed(1)} t is small enough to ship as a shared (LCL) load, which is cheaper here than a full container.` };
  }
  if (!best) return { mode: "FCL", containers: [{ type: "40GP", count: 5 }], summary: "This is very large for the planner. Ask a forwarder to plan the loading." };
  const containers: Plan["containers"] = [];
  if (best.n20) containers.push({ type: "20GP", count: best.n20 });
  if (best.n40) containers.push({ type: "40GP", count: best.n40 });
  const words = containers.map((c) => `${c.count} × ${c.type === "20GP" ? "20 ft" : "40 ft"}`).join(" and ");
  return {
    mode: "FCL",
    containers,
    summary: `${volumeCbm.toFixed(1)} m³ and ${(grossKg / 1000).toFixed(1)} t: ${words} container${best.n20 + best.n40 > 1 ? "s" : ""} (cartons fill about ${Math.round(STUFFING_EFFICIENCY * 100)}% of the volume; weight is within the limit).`,
  };
}

const sum = (xs: RefSource[][]) => [...new Map(xs.flat().map((s) => [s.url, s])).values()].slice(0, 4);
const pick = (r: RefRange, s: Scenario) => r[s];

export function estimateLogistics(input: EstimateInput): Estimate {
  const usdInr = input.usdInr && input.usdInr > 0 ? input.usdInr : USD_INR;
  const inrPerAed = Math.round((usdInr / AED_PER_USD) * 100) / 100;
  const none: Estimate = { ok: false, plan: EMPTY_PLAN, lines: [], usdInr, inrPerAed, asOf: LOGISTICS_AS_OF };
  const { volumeCbm, grossKg } = input;
  if (volumeCbm === null || grossKg === null || !(volumeCbm > 0) || !(grossKg > 0)) {
    return { ...none, problem: "Enter the carton size and weight in the consignment section first. The estimate needs the shipment's volume and weight." };
  }
  if (!Number.isFinite(input.distanceKm) || input.distanceKm < 0 || input.distanceKm > 3000) {
    return { ...none, problem: "Enter the road distance from your factory to the departure port, between 0 and 3000 km." };
  }

  const plan = planShipment(volumeCbm, grossKg);
  const n20 = plan.containers.find((c) => c.type === "20GP")?.count ?? 0;
  const n40 = plan.containers.find((c) => c.type === "40GP")?.count ?? 0;
  const boxes = plan.mode === "FCL" ? n20 + n40 : 1;
  const lclBilled = Math.max(volumeCbm, grossKg / 1000);
  const scen: Scenario[] = ["low", "typical", "high"];
  const by = (f: (s: Scenario) => number, step: number) => {
    const [low, typical, high] = scen.map((s) => roundTo(f(s), step));
    return { low, typical: Math.max(typical, low), high: Math.max(high, typical, low) };
  };

  const inland = by((s) => (plan.mode === "FCL" ? n20 * pick(REF.haulage20, s) * input.distanceKm + n40 * pick(REF.haulage40, s) * input.distanceKm : 0.5 * pick(REF.haulage20, s) * input.distanceKm), 100);
  const origin = by((s) => pick(REF.docs, s) + pick(REF.customsAgent, s) + (plan.mode === "FCL" ? boxes * (pick(REF.originThc, s) + pick(REF.originOther, s)) : 0), 100);
  const ocean = by((s) => (plan.mode === "FCL" ? (n20 * pick(REF.ocean20, s) + n40 * pick(REF.ocean40, s)) * usdInr : lclBilled * pick(REF.lcl, s) * usdInr), 500);
  const insurance = by((s) => pick(REF.insurance, s), 0.01);
  const clearing = by((s) => boxes * pick(REF.destThc, s) + pick(REF.destDo, s) + pick(REF.destClear, s), 5);
  const local = by((s) => boxes * pick(REF.destLocal, s), 5);

  const what = plan.mode === "FCL" ? `${boxes} container${boxes > 1 ? "s" : ""}` : "a shared load";
  const lines: EstimateLine[] = [
    { key: "inlandFreight", label: "Inland freight (factory to port)", currency: "INR", basis: "per_consignment", ...inland, confidence: "low", quality: "model assumption", how: `Road haulage for ${what} over ${input.distanceKm} km, at a typical per-kilometre truck rate. No published tariff was found, so this is the weakest figure here.`, sources: REF.haulage20.sources },
    { key: "exportHandling", label: "Export handling and documentation", currency: "INR", basis: "per_consignment", ...origin, confidence: "low", quality: "older or secondary source", how: `Customs house agent fee, bill-of-lading documentation${plan.mode === "FCL" ? `, and origin terminal handling, seals and user charges for ${boxes} container${boxes > 1 ? "s" : ""}` : ""}.`, sources: sum([REF.docs.sources, REF.originThc.sources, REF.originOther.sources]) },
    { key: "internationalFreight", label: "International freight", currency: "INR", basis: "per_consignment", ...ocean, confidence: "medium", quality: "recent market quote", how: `${plan.mode === "FCL" ? `Current spot ocean rates for ${boxes} container${boxes > 1 ? "s" : ""}` : `A shared-load rate on ${lclBilled.toFixed(1)} billable m³`} at USD ${usdInr.toFixed(2)} to the rupee (${USD_INR_AS_OF}). Rates move quickly and extra surcharges can apply.`, sources: sum([REF.ocean20.sources, REF.ocean40.sources, REF.lcl.sources]) },
    { key: "insurance", label: "Insurance", currency: "INR", basis: "percent_of_goods", ...insurance, confidence: "low", quality: "older or secondary source", how: "Marine cargo insurance as a percentage of the goods value. A typical range from a general guide, not an insurer's tariff.", sources: REF.insurance.sources },
    { key: "destinationClearing", label: "Destination clearing and handling", currency: "AED", basis: "per_consignment", ...clearing, confidence: "low", quality: "older or secondary source", how: `Terminal handling for ${what}, the delivery order, and the customs clearance agent's fee. Based on carrier sheets and an older forwarder quote.`, sources: sum([REF.destThc.sources, REF.destDo.sources, REF.destClear.sources]) },
    { key: "otherDestination", label: "Other destination costs", currency: "AED", basis: "per_consignment", ...local, confidence: "low", quality: "older or secondary source", how: `Local delivery from the port for ${what}. Based on an older forwarder quote.`, sources: REF.destLocal.sources },
  ];
  return { ok: true, plan, lines, usdInr, inrPerAed, asOf: LOGISTICS_AS_OF };
}

export const lineValue = (l: EstimateLine, s: Scenario) => l[s];

/** The six calculator lines as a patch, for one scenario. Never marks anything confirmed. */
export function toLinePatch(e: Estimate, s: Scenario) {
  return e.lines.map((l) => ({ key: l.key, amount: lineValue(l, s), currency: l.currency, basis: l.basis, confirmed: false as const }));
}
