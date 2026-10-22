import type { Basis, CostLine, Inputs, LineKey, LineResult, Result, Validation } from "./types.ts";

/**
 * The landed-cost and margin calculation. Pure, deterministic and free of any market data.
 *
 * Cost model (all converted to INR with the user's exchange rate):
 *   total cost = goods (production cost x units)
 *              + packaging + inland freight + export handling      (origin)
 *              + international freight + insurance                  (international)
 *              + destination clearing + other destination costs     (destination)
 *              + other charges
 *              + customs duty
 * Each charge is counted once, in exactly one line. Duty is computed from its base, never added
 * on top of a cost that already contains it. Import VAT is deliberately NOT included (normally
 * recoverable by a VAT-registered importer: confirm with an adviser), and neither are income tax,
 * financing costs, bank charges or any importer margin.
 *
 * Margin vs markup: gross margin = profit / revenue. Markup = profit / cost. They differ and are
 * reported separately.
 *
 * Rounding: every line total is rounded to the nearest paisa (half up) before summing, so the lines
 * always add up exactly to the total. Per-unit values are derived from the rounded totals.
 */

export const LIMITS = { money: 1e9, units: 1e8, percent: 100, fx: 1000, dimMm: 100000, weightKg: 100000 } as const;

export const LINE_LABELS: Record<LineKey, string> = {
  packaging: "Packaging",
  inlandFreight: "Inland freight (factory to port)",
  exportHandling: "Export handling and documentation",
  internationalFreight: "International freight",
  insurance: "Insurance",
  destinationClearing: "Destination clearing and handling",
  otherCharges: "Other charges",
  otherDestination: "Other destination costs",
};

const LINE_GROUPS: Record<LineKey, LineResult["group"]> = {
  packaging: "Packaging",
  inlandFreight: "Origin logistics",
  exportHandling: "Origin logistics",
  internationalFreight: "International",
  insurance: "International",
  destinationClearing: "Destination",
  otherCharges: "Other",
  otherDestination: "Destination",
};

export const LINE_ORDER: LineKey[] = [
  "packaging",
  "inlandFreight",
  "exportHandling",
  "internationalFreight",
  "insurance",
  "destinationClearing",
  "otherDestination",
  "otherCharges",
];

/** Round to 2 decimals, half away from zero, tolerant of binary floating-point error. */
export const round2 = (n: number): number => {
  const sign = n < 0 ? -1 : 1;
  return (sign * Math.round((Math.abs(n) + Number.EPSILON) * 100)) / 100;
};

const isFiniteNumber = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** Units in the consignment, whichever way the user entered the quantity. */
export function totalUnits(i: Pick<Inputs, "quantity" | "quantityUnit" | "unitsPerCarton">): number {
  return i.quantityUnit === "cartons" ? i.quantity * i.unitsPerCarton : i.quantity;
}

export function cartonCount(i: Pick<Inputs, "quantity" | "quantityUnit" | "unitsPerCarton">): number {
  return i.quantityUnit === "cartons" ? i.quantity : Math.ceil(i.quantity / i.unitsPerCarton);
}

export function cartonVolumeCbm(i: Pick<Inputs, "cartonLengthMm" | "cartonWidthMm" | "cartonHeightMm">): number | null {
  if (i.cartonLengthMm === null || i.cartonWidthMm === null || i.cartonHeightMm === null) return null;
  return (i.cartonLengthMm * i.cartonWidthMm * i.cartonHeightMm) / 1e9; // mm^3 to m^3
}

export function validateInputs(i: Inputs): Validation {
  const errors: Record<string, string> = {};
  const warnings: string[] = [];
  const must = (ok: boolean, key: string, msg: string) => {
    if (!ok) errors[key] = msg;
  };

  must(isFiniteNumber(i.quantity) && i.quantity >= 1 && i.quantity <= LIMITS.units && Number.isInteger(i.quantity), "quantity", "Enter a whole number of at least 1.");
  must(isFiniteNumber(i.unitsPerCarton) && i.unitsPerCarton >= 1 && Number.isInteger(i.unitsPerCarton) && i.unitsPerCarton <= 1e6, "unitsPerCarton", "Enter a whole number of at least 1.");
  must(isFiniteNumber(i.unitProductionCostInr) && i.unitProductionCostInr >= 0 && i.unitProductionCostInr <= LIMITS.money, "unitProductionCostInr", "Enter a cost of 0 or more.");
  must(isFiniteNumber(i.inrPerAed) && i.inrPerAed > 0 && i.inrPerAed <= LIMITS.fx, "inrPerAed", "Enter how many INR equal 1 AED (more than 0).");
  must(isFiniteNumber(i.sellingPriceAed) && i.sellingPriceAed >= 0 && i.sellingPriceAed <= LIMITS.money, "sellingPriceAed", "Enter a price of 0 or more.");
  must(isFiniteNumber(i.targetMarginPercent) && i.targetMarginPercent >= 0 && i.targetMarginPercent < 100, "targetMarginPercent", "Enter a margin from 0 up to (not including) 100.");
  must(isFiniteNumber(i.duty.ratePercent) && i.duty.ratePercent >= 0 && i.duty.ratePercent <= LIMITS.percent, "duty.ratePercent", "Enter a rate from 0 to 100.");
  must(
    isFiniteNumber(i.duty.preferentialRatePercent) && i.duty.preferentialRatePercent >= 0 && i.duty.preferentialRatePercent <= LIMITS.percent,
    "duty.preferentialRatePercent",
    "Enter a rate from 0 to 100.",
  );

  const optional = (v: number | null, key: string, max: number) =>
    must(v === null || (isFiniteNumber(v) && v > 0 && v <= max), key, "Enter a number above 0, or leave empty.");
  optional(i.cartonGrossWeightKg, "cartonGrossWeightKg", LIMITS.weightKg);
  optional(i.cartonLengthMm, "cartonLengthMm", LIMITS.dimMm);
  optional(i.cartonWidthMm, "cartonWidthMm", LIMITS.dimMm);
  optional(i.cartonHeightMm, "cartonHeightMm", LIMITS.dimMm);
  const dims = [i.cartonLengthMm, i.cartonWidthMm, i.cartonHeightMm].filter((d) => d !== null).length;
  must(dims === 0 || dims === 3, "cartonLengthMm", "Give all three carton dimensions, or none.");

  const volume = cartonVolumeCbm(i);
  for (const key of LINE_ORDER) {
    const l = i.lines[key];
    const p = `lines.${key}`;
    must(isFiniteNumber(l.amount) && l.amount >= 0 && l.amount <= LIMITS.money, `${p}.amount`, "Enter 0 or more.");
    if (l.basis === "percent_of_goods") {
      must(key === "insurance", `${p}.basis`, "A percentage of goods value is only available for insurance.");
      must(l.amount <= 100, `${p}.amount`, "A percentage cannot exceed 100.");
    }
    if (l.basis === "per_kg") must(i.cartonGrossWeightKg !== null || l.amount === 0, `${p}.basis`, "Per kg needs the carton gross weight.");
    if (l.basis === "per_cbm") must(volume !== null || l.amount === 0, `${p}.basis`, "Per cubic metre needs the carton dimensions.");
  }

  if (Object.keys(errors).length === 0) {
    if (i.sellingPriceAed === 0) warnings.push("Selling price is 0, so there is no revenue and margin cannot be shown.");
    if (i.duty.ratePercent === 0) warnings.push("Customs duty is set to 0%. Confirm that for your product code before relying on the result.");
    if (i.duty.applyPreference) warnings.push("The preferential duty rate is being applied. Eligibility has not been verified: treat the result as hypothetical.");
    if (i.cartonGrossWeightKg === null && i.cartonLengthMm === null) warnings.push("Carton weight and size are missing, so weight and volume cannot be shown.");
  }
  return { errors, warnings };
}

const toInr = (amount: number, currency: CostLine["currency"], inrPerAed: number) => (currency === "AED" ? amount * inrPerAed : amount);

/**
 * Computes the full result. Throws if the inputs are invalid: call validateInputs first (the
 * interface does). Returning wrong numbers for bad input is worse than refusing.
 */
export function calculate(i: Inputs): Result {
  const v = validateInputs(i);
  if (Object.keys(v.errors).length > 0) throw new Error("Invalid inputs: " + Object.keys(v.errors).join(", "));

  const units = totalUnits(i);
  const cartons = cartonCount(i);
  const grossWeightKg = i.cartonGrossWeightKg === null ? null : i.cartonGrossWeightKg * cartons;
  const cbm = cartonVolumeCbm(i);
  const volumeCbm = cbm === null ? null : cbm * cartons;

  const goodsInr = round2(i.unitProductionCostInr * units);

  const lineTotal = (key: LineKey, l: CostLine, goodsForPercent: number): number => {
    const a = l.amount;
    const byBasis: Record<Basis, number> = {
      per_consignment: toInr(a, l.currency, i.inrPerAed),
      per_unit: toInr(a, l.currency, i.inrPerAed) * units,
      per_carton: toInr(a, l.currency, i.inrPerAed) * cartons,
      per_kg: toInr(a, l.currency, i.inrPerAed) * (grossWeightKg ?? 0),
      per_cbm: toInr(a, l.currency, i.inrPerAed) * (volumeCbm ?? 0),
      percent_of_goods: (goodsForPercent * a) / 100,
    };
    return round2(byBasis[l.basis]);
  };

  // Packaging is computed first because insurance as a percentage is taken on goods plus packaging.
  const packagingInr = lineTotal("packaging", i.lines.packaging, 0);
  const goodsAndPackaging = goodsInr + packagingInr;

  const results: LineResult[] = [
    { key: "goods", label: "Goods (production cost)", group: "Production", totalInr: goodsInr, perUnitInr: 0, confirmed: false, note: `${units.toLocaleString("en-IN")} units x INR ${i.unitProductionCostInr}` },
  ];
  const totals: Record<LineKey, number> = { packaging: packagingInr } as Record<LineKey, number>;
  for (const key of LINE_ORDER) {
    const l = i.lines[key];
    totals[key] = key === "packaging" ? packagingInr : lineTotal(key, l, goodsAndPackaging);
    results.push({
      key,
      label: LINE_LABELS[key],
      group: LINE_GROUPS[key],
      totalInr: totals[key],
      perUnitInr: 0,
      confirmed: l.confirmed && totals[key] > 0,
      note: l.basis === "percent_of_goods" ? `${l.amount}% of goods value` : `${l.amount} ${l.currency} ${l.basis.replace("_", " ")}`,
    });
  }

  // Customs value. cif_cost: goods and every cost up to the destination port, at your cost.
  // selling_price: the invoice value, which is your selling price.
  const revenueInr = round2(i.sellingPriceAed * i.inrPerAed * units);
  const cifCostBase = round2(goodsInr + totals.packaging + totals.inlandFreight + totals.exportHandling + totals.internationalFreight + totals.insurance);
  const dutyBaseInr = i.duty.basis === "selling_price" ? revenueInr : cifCostBase;
  const dutyRateApplied = i.duty.applyPreference ? i.duty.preferentialRatePercent : i.duty.ratePercent;
  const dutyInr = round2((dutyBaseInr * dutyRateApplied) / 100);
  results.push({
    key: "duty",
    label: "Customs duty (assumption)",
    group: "Duty",
    totalInr: dutyInr,
    perUnitInr: 0,
    confirmed: false,
    note: `${dutyRateApplied}% of ${i.duty.basis === "selling_price" ? "selling price (invoice value)" : "goods plus costs to the destination port"}`,
  });

  const totalCostInr = round2(results.reduce((n, l) => n + l.totalInr, 0));
  for (const l of results) l.perUnitInr = round2(l.totalInr / units);

  const grossProfitInr = round2(revenueInr - totalCostInr);
  const nonDutyInr = round2(totalCostInr - dutyInr);
  const r = dutyRateApplied / 100;

  // Break-even price per unit (INR). If duty is charged on the selling price, price appears on both
  // sides: P*units = nonDuty + r*P*units, so P = nonDuty / (units*(1-r)).
  const breakEvenInr =
    i.duty.basis === "selling_price" ? (r < 1 ? nonDutyInr / (units * (1 - r)) : Number.POSITIVE_INFINITY) : totalCostInr / units;

  const m = i.targetMarginPercent / 100;
  let priceForTarget: number | null;
  if (i.duty.basis === "selling_price") priceForTarget = 1 - r - m > 0 ? nonDutyInr / (units * (1 - r - m) * i.inrPerAed) : null;
  else priceForTarget = totalCostInr / (units * (1 - m) * i.inrPerAed);

  const confirmedInr = results.filter((l) => l.confirmed).reduce((n, l) => n + l.totalInr, 0);

  return {
    units,
    cartons,
    grossWeightKg,
    volumeCbm,
    inrPerAed: i.inrPerAed,
    lines: results,
    goodsInr,
    dutyBaseInr,
    dutyRateApplied,
    dutyInr,
    totalCostInr,
    totalCostAed: round2(totalCostInr / i.inrPerAed),
    landedPerUnitInr: round2(totalCostInr / units),
    landedPerUnitAed: round2(totalCostInr / units / i.inrPerAed),
    revenueInr,
    revenueAed: round2(revenueInr / i.inrPerAed),
    grossProfitInr,
    grossProfitAed: round2(grossProfitInr / i.inrPerAed),
    profitPerUnitAed: round2(grossProfitInr / units / i.inrPerAed),
    grossMarginPct: revenueInr > 0 ? round2((grossProfitInr / revenueInr) * 100) : null,
    markupPct: totalCostInr > 0 ? round2((grossProfitInr / totalCostInr) * 100) : null,
    breakEvenPriceAed: Number.isFinite(breakEvenInr) ? round2(breakEvenInr / i.inrPerAed) : Number.POSITIVE_INFINITY,
    breakEvenPriceInr: Number.isFinite(breakEvenInr) ? round2(breakEvenInr) : Number.POSITIVE_INFINITY,
    priceForTargetMarginAed: priceForTarget === null ? null : round2(priceForTarget),
    confirmedSharePct: totalCostInr > 0 ? round2((confirmedInr / totalCostInr) * 100) : 0,
  };
}

export interface Sensitivity {
  key: string;
  label: string;
  changeLabel: string;
  /** Margin in percentage points after the change; null if revenue is zero. */
  marginPct: number | null;
  /** Change in margin, in percentage points. */
  deltaPp: number | null;
  profitAed: number;
}

type Tweak = { key: string; label: string; apply: (i: Inputs, f: number) => Inputs };

const scaleLine = (i: Inputs, key: LineKey, f: number): Inputs => ({
  ...i,
  lines: { ...i.lines, [key]: { ...i.lines[key], amount: i.lines[key].amount * f } },
});

export const TWEAKS: Tweak[] = [
  { key: "price", label: "Selling price", apply: (i, f) => ({ ...i, sellingPriceAed: i.sellingPriceAed * f }) },
  { key: "cost", label: "Unit production cost", apply: (i, f) => ({ ...i, unitProductionCostInr: i.unitProductionCostInr * f }) },
  { key: "intlFreight", label: "International freight", apply: (i, f) => scaleLine(i, "internationalFreight", f) },
  { key: "packaging", label: "Packaging cost", apply: (i, f) => scaleLine(i, "packaging", f) },
  { key: "fx", label: "Exchange rate (INR per AED)", apply: (i, f) => ({ ...i, inrPerAed: i.inrPerAed * f }) },
  { key: "duty", label: "Customs duty rate", apply: (i, f) => ({ ...i, duty: { ...i.duty, ratePercent: Math.min(100, i.duty.ratePercent * f), preferentialRatePercent: Math.min(100, i.duty.preferentialRatePercent * f) } }) },
];

/**
 * One-at-a-time sensitivities: each variable is moved down and up by `pct` percent (relative) with
 * everything else held, and the effect on gross margin is reported in percentage points.
 */
export function sensitivities(i: Inputs, pct = 10): Sensitivity[] {
  const base = calculate(i);
  const out: Sensitivity[] = [];
  for (const t of TWEAKS) {
    for (const sign of [-1, 1]) {
      const r = calculate(t.apply(i, 1 + (sign * pct) / 100));
      out.push({
        key: `${t.key}${sign > 0 ? "+" : "-"}`,
        label: t.label,
        changeLabel: `${sign > 0 ? "+" : "-"}${pct}%`,
        marginPct: r.grossMarginPct,
        deltaPp: r.grossMarginPct === null || base.grossMarginPct === null ? null : round2(r.grossMarginPct - base.grossMarginPct),
        profitAed: r.grossProfitAed,
      });
    }
  }
  return out;
}

/**
 * How far the international freight amount can rise before gross profit reaches zero, as a percent
 * of the current amount. Profit is linear in freight (duty on cost included), so two evaluations
 * give the exact crossing. Returns null when freight is zero, Infinity if freight cannot cause a loss
 * (price-based duty with no freight effect), and 0 when profit is already zero or negative.
 */
export function freightHeadroomPct(i: Inputs): number | null {
  const f0 = i.lines.internationalFreight.amount;
  if (f0 <= 0) return null;
  const p0 = calculate(i).grossProfitInr;
  if (p0 <= 0) return 0;
  const p1 = calculate(scaleLine(i, "internationalFreight", 2)).grossProfitInr;
  const slope = p1 - p0; // profit change when freight doubles
  if (slope >= 0) return Number.POSITIVE_INFINITY;
  return round2((p0 / -slope) * 100);
}
