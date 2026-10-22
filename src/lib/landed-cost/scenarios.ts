import { calculate, round2, validateInputs } from "./calc.ts";
import type { Inputs, Result, Scenario, Verdict } from "./types.ts";

/**
 * Scenario comparison. A scenario is a small set of changes applied on top of the base inputs, so
 * editing the base updates every scenario and nothing has to be typed twice.
 */

export const DEFAULT_SCENARIOS: Scenario[] = [
  { id: "base", name: "Base case", kind: "base", freightPct: 0, pricePct: 0, costPct: 0, fxPct: 0, preferentialDuty: false },
  { id: "freight", name: "Higher freight", kind: "freight", freightPct: 30, pricePct: 0, costPct: 0, fxPct: 0, preferentialDuty: false },
  { id: "price", name: "Better selling price", kind: "price", freightPct: 0, pricePct: 10, costPct: 0, fxPct: 0, preferentialDuty: false },
  { id: "tariff", name: "Preferential tariff (hypothetical)", kind: "tariff", freightPct: 0, pricePct: 0, costPct: 0, fxPct: 0, preferentialDuty: true },
];

export function applyScenario(base: Inputs, s: Scenario): Inputs {
  const f = (pct: number) => 1 + pct / 100;
  return {
    ...base,
    unitProductionCostInr: base.unitProductionCostInr * f(s.costPct),
    sellingPriceAed: base.sellingPriceAed * f(s.pricePct),
    inrPerAed: base.inrPerAed * f(s.fxPct),
    lines: {
      ...base.lines,
      internationalFreight: { ...base.lines.internationalFreight, amount: base.lines.internationalFreight.amount * f(s.freightPct) },
    },
    duty: { ...base.duty, applyPreference: s.kind === "base" ? base.duty.applyPreference : s.preferentialDuty || base.duty.applyPreference },
  };
}

/**
 * A preferential-duty scenario only means something when the hypothetical rate is below the
 * ordinary duty assumption. Otherwise it is shown as not applicable instead of faking a difference.
 */
export function scenarioApplicable(base: Inputs, s: Scenario): { applicable: boolean; reason?: string } {
  if (s.preferentialDuty && base.duty.preferentialRatePercent >= base.duty.ratePercent) {
    return {
      applicable: false,
      reason: "The hypothetical preferential rate is not lower than the ordinary duty assumption, so this scenario would change nothing. Lower the preferential rate, or set the ordinary rate, to compare.",
    };
  }
  return { applicable: true };
}

export function verdictFor(r: Result, targetMarginPct: number): Verdict {
  if (r.grossProfitInr < 0) return "loss";
  if (r.grossMarginPct === null || r.grossMarginPct < targetMarginPct) return "below_target";
  return "meets_target";
}

export interface ScenarioRow {
  scenario: Scenario;
  applicable: boolean;
  reason?: string;
  result: Result | null;
  verdict: Verdict | null;
  /** Differences against the base case. Money in AED per unit, margin in percentage points. */
  delta: { landedPerUnitAed: number; priceAed: number; profitAed: number; marginPp: number | null } | null;
}

export function compareScenarios(base: Inputs, scenarios: Scenario[]): ScenarioRow[] {
  if (Object.keys(validateInputs(base).errors).length > 0) return [];
  const baseScenario = scenarios.find((s) => s.kind === "base") ?? DEFAULT_SCENARIOS[0];
  const baseResult = calculate(applyScenario(base, baseScenario));
  return scenarios.map((scenario) => {
    const { applicable, reason } = scenarioApplicable(base, scenario);
    if (!applicable) return { scenario, applicable, reason, result: null, verdict: null, delta: null };
    const inputs = applyScenario(base, scenario);
    if (Object.keys(validateInputs(inputs).errors).length > 0) return { scenario, applicable: false, reason: "These changes make an input invalid.", result: null, verdict: null, delta: null };
    const result = calculate(inputs);
    return {
      scenario,
      applicable: true,
      result,
      verdict: verdictFor(result, base.targetMarginPercent),
      delta: {
        landedPerUnitAed: round2(result.landedPerUnitAed - baseResult.landedPerUnitAed),
        priceAed: round2(inputs.sellingPriceAed - applyScenario(base, baseScenario).sellingPriceAed),
        profitAed: round2(result.grossProfitAed - baseResult.grossProfitAed),
        marginPp: result.grossMarginPct === null || baseResult.grossMarginPct === null ? null : round2(result.grossMarginPct - baseResult.grossMarginPct),
      },
    };
  });
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  loss: "Loss at these assumptions",
  below_target: "Below your target margin",
  meets_target: "Meets your target margin",
};
